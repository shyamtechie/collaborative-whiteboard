require('dotenv').config();

var PORT = process.env.PORT || 8080;

var express = require('express');
var cors = require('cors');
var fs = require('fs');
var path = require('path');

var { GoogleGenAI } = require('@google/genai');

var app = express();

// ============================================================
// CORS
// ============================================================

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',

    methods: ['GET', 'POST', 'OPTIONS'],
  }),
);

// ============================================================
// JSON BODY
// ============================================================

app.use(
  express.json({
    limit: '15mb',
  }),
);

// ============================================================
// STATIC FILES
// ============================================================

app.use(express.static(__dirname + '/public'));

// ============================================================
// HTTP SERVER
// ============================================================

var server = require('http').Server(app);

// ============================================================
// SOCKET.IO
// ============================================================

var io = require('socket.io')(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',

    methods: ['GET', 'POST'],
  },
});

// ============================================================
// USERS
// ============================================================

var users = {};

// ============================================================
// DRAWINGS
// ============================================================

var drawings = {};

// ============================================================
// PERSISTENCE FILE
// ============================================================

var dataFile = path.join(__dirname, 'temp', 'whiteboards.json');

// ============================================================
// LOAD SAVED WHITEBOARDS
// ============================================================

if (fs.existsSync(dataFile)) {
  try {
    drawings = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

    console.log('Saved whiteboards loaded');
  } catch (error) {
    console.log('Could not load saved whiteboards');

    drawings = {};
  }
}

// ============================================================
// SAVE WHITEBOARDS
// ============================================================

function saveWhiteboards() {
  try {
    var tempDirectory = path.dirname(dataFile);

    if (!fs.existsSync(tempDirectory)) {
      fs.mkdirSync(tempDirectory, {
        recursive: true,
      });
    }

    fs.writeFileSync(dataFile, JSON.stringify(drawings, null, 2), 'utf8');
  } catch (error) {
    console.error('Could not save whiteboards:');

    console.error(error);
  }
}

// ============================================================
// GEMINI AI
// ============================================================

var gemini = null;

if (process.env.GEMINI_API_KEY) {
  gemini = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  console.log('Gemini AI assistant enabled');
} else {
  console.log('GEMINI_API_KEY not found. AI assistant disabled.');
}

// ============================================================
// GEMINI MODELS
// ============================================================

var PRIMARY_MODEL = 'gemini-3.8-flash';

var FALLBACK_MODEL = 'gemini-3.6-flash';

// ============================================================
// AI PROMPTS
// ============================================================

var aiPrompts = {
  explain:
    'Explain the whiteboard clearly. Identify the main diagram, flow, concepts, labels, relationships, and steps that can actually be seen. If the drawing is unclear or mostly blank, say so instead of guessing.',

  summarize:
    'Summarize the whiteboard in a concise and useful way. Focus only on information that can actually be seen in the drawing. Mention the main idea, important components, and relationships.',

  improve:
    'Review the whiteboard as a software, design, architecture, process, or learning diagram. First describe what is actually visible. Then identify specific problems or missing elements. Then give practical improvements that the user can apply to the current diagram. If the board is very simple or mostly blank, do not pretend it represents something specific. Instead, explain what is missing and provide a clearly labeled example structure the user could create. Focus on labels, relationships, arrows, organization, hierarchy, clarity, completeness, and layout. Never present your suggested example as something that already exists on the whiteboard.',
};

// ============================================================
// WAIT HELPER
// ============================================================

function wait(milliseconds) {
  return new Promise(function (resolve) {
    setTimeout(resolve, milliseconds);
  });
}

// ============================================================
// CHECK IF ERROR IS TEMPORARY
// ============================================================

function isTemporaryGeminiError(error) {
  if (!error) {
    return false;
  }

  var status = error.status;

  var message = error.message || '';

  if (status === 503 || status === 429 || status === 500) {
    return true;
  }

  if (message.includes('UNAVAILABLE')) {
    return true;
  }

  if (message.includes('high demand')) {
    return true;
  }

  if (message.includes('temporarily')) {
    return true;
  }

  return false;
}

// ============================================================
// CALL GEMINI MODEL
// ============================================================

async function callGeminiModel(model, base64Image, mimeType, action) {
  console.log('Calling Gemini model:', model);

  var response = await gemini.models.generateContent({
    model: model,

    contents: [
      {
        inlineData: {
          mimeType: mimeType,

          data: base64Image,
        },
      },

      {
        text:
          aiPrompts[action] +
          '\n\n' +
          'You are analyzing a collaborative whiteboard image. ' +
          'Treat it as a hand-drawn or digital whiteboard. ' +
          'Be honest about uncertainty. ' +
          'Do not hallucinate details that are not visible. ' +
          'Give the response in a clear, practical format.',
      },
    ],

    config: {
      maxOutputTokens: 500,

      thinkingConfig: {
        thinkingLevel: 'low',
      },
    },
  });

  var result = response.text;

  if (!result) {
    throw new Error('Gemini returned an empty response.');
  }

  return result;
}

// ============================================================
// GEMINI REQUEST WITH RETRY + FALLBACK
// ============================================================

async function analyzeWithFallback(base64Image, mimeType, action) {
  // --------------------------------------------------------
  // PRIMARY MODEL - ATTEMPT 1
  // --------------------------------------------------------

  try {
    console.log('AI request:', action);

    console.log('Trying primary model:', PRIMARY_MODEL);

    var result = await callGeminiModel(
      PRIMARY_MODEL,
      base64Image,
      mimeType,
      action,
    );

    console.log('Primary model succeeded:', PRIMARY_MODEL);

    return {
      result: result,

      model: PRIMARY_MODEL,
    };
  } catch (error) {
    console.error('Primary model attempt 1 failed.');

    console.error(error.message);

    // ----------------------------------------------------
    // Only retry temporary errors
    // ----------------------------------------------------

    if (!isTemporaryGeminiError(error)) {
      throw error;
    }
  }

  // --------------------------------------------------------
  // WAIT BEFORE RETRY
  // --------------------------------------------------------

  console.log('Gemini 3.8 temporarily unavailable.');

  console.log('Waiting 2 seconds before retry...');

  await wait(2000);

  // --------------------------------------------------------
  // PRIMARY MODEL - ATTEMPT 2
  // --------------------------------------------------------

  try {
    console.log('Retrying primary model:', PRIMARY_MODEL);

    var retryResult = await callGeminiModel(
      PRIMARY_MODEL,
      base64Image,
      mimeType,
      action,
    );

    console.log('Primary model retry succeeded:', PRIMARY_MODEL);

    return {
      result: retryResult,

      model: PRIMARY_MODEL,
    };
  } catch (error) {
    console.error('Primary model attempt 2 failed.');

    console.error(error.message);

    if (!isTemporaryGeminiError(error)) {
      throw error;
    }
  }

  // --------------------------------------------------------
  // FALLBACK MODEL
  // --------------------------------------------------------

  console.log('Gemini 3.8 still unavailable.');

  console.log('Switching to fallback model:', FALLBACK_MODEL);

  try {
    var fallbackResult = await callGeminiModel(
      FALLBACK_MODEL,
      base64Image,
      mimeType,
      action,
    );

    console.log('Fallback model succeeded:', FALLBACK_MODEL);

    return {
      result: fallbackResult,

      model: FALLBACK_MODEL,
    };
  } catch (error) {
    console.error('Fallback model failed.');

    console.error(error.message);

    throw error;
  }
}

// ============================================================
// AI WHITEBOARD ANALYSIS
// ============================================================

app.post('/api/ai/analyze', async function (req, res) {
  try {
    // ------------------------------------------------
    // Check Gemini
    // ------------------------------------------------

    if (!gemini) {
      return res.status(503).json({
        error: 'Gemini AI assistant is not configured on the server.',
      });
    }

    // ------------------------------------------------
    // Get request data
    // ------------------------------------------------

    var image = req.body.image;

    var action = req.body.action;

    // ------------------------------------------------
    // Validate image
    // ------------------------------------------------

    if (!image) {
      return res.status(400).json({
        error: 'Whiteboard image is required.',
      });
    }

    if (typeof image !== 'string' || !image.startsWith('data:image/')) {
      return res.status(400).json({
        error: 'Invalid whiteboard image format.',
      });
    }

    // ------------------------------------------------
    // Validate action
    // ------------------------------------------------

    var allowedActions = ['explain', 'summarize', 'improve'];

    if (!allowedActions.includes(action)) {
      return res.status(400).json({
        error: 'Invalid AI action.',
      });
    }

    console.log('================================================');

    console.log('Gemini whiteboard request:', action);

    // ------------------------------------------------
    // Split image
    // ------------------------------------------------

    var imageParts = image.split(',');

    if (imageParts.length !== 2) {
      return res.status(400).json({
        error: 'Invalid image data.',
      });
    }

    var imageHeader = imageParts[0];

    var base64Image = imageParts[1];

    // ------------------------------------------------
    // Detect MIME type
    // ------------------------------------------------

    var mimeMatch = imageHeader.match(/data:(image\/[^;]+);base64/);

    var mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

    console.log('Image type:', mimeType);

    // ------------------------------------------------
    // Analyze with retry + fallback
    // ------------------------------------------------

    var analysis = await analyzeWithFallback(base64Image, mimeType, action);

    console.log('AI response generated successfully.');

    console.log('Model used:', analysis.model);

    console.log('================================================');

    // ------------------------------------------------
    // Send response
    // ------------------------------------------------

    return res.json({
      result: analysis.result,

      model: analysis.model,
    });
  } catch (error) {
    console.error('================================================');

    console.error('Gemini analysis failed completely:');

    console.error(error);

    console.error('================================================');

    return res.status(500).json({
      error: error.message || 'Unable to analyze the whiteboard right now.',
    });
  }
});

// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/api/health', function (req, res) {
  res.json({
    status: 'ok',

    ai: Boolean(gemini),

    provider: gemini ? 'gemini' : 'none',

    primaryModel: gemini ? PRIMARY_MODEL : null,

    fallbackModel: gemini ? FALLBACK_MODEL : null,
  });
});

// ============================================================
// START SERVER
// ============================================================

server.listen(PORT, '0.0.0.0', function () {
  console.log('================================================');

  console.log('Webserver & socketserver running on port: ' + PORT);

  console.log('Primary AI model:', PRIMARY_MODEL);

  console.log('Fallback AI model:', FALLBACK_MODEL);

  console.log('================================================');
});

// ============================================================
// SOCKET.IO CONNECTION
// ============================================================

io.on('connection', function (socket) {
  console.log('Client connected:', socket.id);

  // ====================================================
  // JOIN ROOM
  // ====================================================

  socket.on('joinRoom', function (data) {
    var roomId = data.roomId;

    var username = data.username;

    console.log(username + ' joined room ' + roomId);

    socket.join(roomId);

    socket.roomId = roomId;

    socket.username = username;

    if (!users[roomId]) {
      users[roomId] = {};
    }

    users[roomId][socket.id] = username;

    if (!drawings[roomId]) {
      drawings[roomId] = [];
    }

    io.to(roomId).emit('usersUpdate', users[roomId]);

    socket.emit('boardUpdate', drawings[roomId]);
  });

  // ====================================================
  // DRAW
  // ====================================================

  socket.on('drawToWhiteboard', function (drawingData) {
    var roomId = socket.roomId;

    if (!roomId) {
      return;
    }

    if (!drawings[roomId]) {
      drawings[roomId] = [];
    }

    var drawing = {
      socketId: socket.id,

      username: drawingData.username,

      stroke: drawingData.stroke,
    };

    drawings[roomId].push(drawing);

    saveWhiteboards();

    console.log('Drawing received from:', socket.username, 'in room:', roomId);

    socket.to(roomId).emit('drawToWhiteboard', drawingData);
  });

  // ====================================================
  // CLEAR BOARD
  // ====================================================

  socket.on('clearBoard', function () {
    var roomId = socket.roomId;

    if (!roomId) {
      return;
    }

    console.log('Whiteboard cleared in room:', roomId);

    drawings[roomId] = [];

    saveWhiteboards();

    io.to(roomId).emit('clearBoard');
  });

  // ====================================================
  // UNDO
  // ====================================================

  socket.on('undo', function () {
    var roomId = socket.roomId;

    if (!roomId || !drawings[roomId]) {
      return;
    }

    console.log('Undo requested by:', socket.username, 'in room:', roomId);

    for (var i = drawings[roomId].length - 1; i >= 0; i--) {
      if (drawings[roomId][i].socketId === socket.id) {
        drawings[roomId].splice(i, 1);

        break;
      }
    }

    saveWhiteboards();

    io.to(roomId).emit('boardUpdate', drawings[roomId]);
  });

  // ====================================================
  // LIVE CURSOR
  // ====================================================

  socket.on('cursorMove', function (cursorData) {
    var roomId = socket.roomId;

    if (!roomId) {
      return;
    }

    cursorData.socketId = socket.id;

    socket.to(roomId).emit('cursorMove', cursorData);
  });

  // ====================================================
  // DISCONNECT
  // ====================================================

  socket.on('disconnect', function () {
    var roomId = socket.roomId;

    console.log('Client disconnected:', socket.id);

    if (!roomId) {
      return;
    }

    if (users[roomId]) {
      delete users[roomId][socket.id];

      io.to(roomId).emit('usersUpdate', users[roomId]);
    }

    io.to(roomId).emit('cursorRemove', socket.id);

    if (users[roomId] && Object.keys(users[roomId]).length === 0) {
      delete users[roomId];

      console.log('Everyone left room:', roomId);
    }
  });
});
