var PORT = 8080;

var express = require('express');
var fs = require('fs');
var path = require('path');

var app = express();

app.use(express.static(__dirname + '/public'));

var server = require('http').Server(app);

var io = require('socket.io')(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Store users currently connected to each room
var users = {};

// Store drawings for each room
var drawings = {};

// File where whiteboard data will be saved
var dataFile = path.join(__dirname, 'temp', 'whiteboards.json');

// --------------------------------------
// Load saved whiteboards when server starts
// --------------------------------------

if (fs.existsSync(dataFile)) {
  try {
    drawings = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    console.log('Saved whiteboards loaded');
  } catch (error) {
    console.log('Could not load saved whiteboards');
    drawings = {};
  }
}

// --------------------------------------
// Save whiteboards to JSON file
// --------------------------------------

function saveWhiteboards() {
  fs.writeFileSync(dataFile, JSON.stringify(drawings, null, 2), 'utf8');
}

// --------------------------------------
// Start server
// --------------------------------------

server.listen(PORT, function () {
  console.log('Webserver & socketserver running on port:' + PORT);
});

// --------------------------------------
// Socket.IO
// --------------------------------------

io.on('connection', function (socket) {
  console.log('Client connected:', socket.id);

  // ----------------------------------
  // JOIN ROOM
  // ----------------------------------

  socket.on('joinRoom', function (data) {
    var roomId = data.roomId;
    var username = data.username;

    console.log(username + ' joined room ' + roomId);

    socket.join(roomId);

    socket.roomId = roomId;
    socket.username = username;

    // Create users object for this room
    if (!users[roomId]) {
      users[roomId] = {};
    }

    users[roomId][socket.id] = username;

    // Create drawing array if room has never existed
    if (!drawings[roomId]) {
      drawings[roomId] = [];
    }

    // Send current users to everyone in room
    io.to(roomId).emit('usersUpdate', users[roomId]);

    // Send saved drawings to newly joined user
    socket.emit('boardUpdate', drawings[roomId]);
  });

  // ----------------------------------
  // DRAW
  // ----------------------------------

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

    // Store drawing
    drawings[roomId].push(drawing);

    // Save drawing permanently
    saveWhiteboards();

    console.log('Drawing received from:', socket.username, 'in room:', roomId);

    // Send drawing to other users in same room
    socket.to(roomId).emit('drawToWhiteboard', drawingData);
  });

  // ----------------------------------
  // CLEAR BOARD
  // ----------------------------------

  socket.on('clearBoard', function () {
    var roomId = socket.roomId;

    if (!roomId) {
      return;
    }

    console.log('Whiteboard cleared in room:', roomId);

    drawings[roomId] = [];

    // Save cleared board
    saveWhiteboards();

    // Clear everyone's board in this room
    io.to(roomId).emit('clearBoard');
  });

  // ----------------------------------
  // UNDO
  // ----------------------------------

  socket.on('undo', function () {
    var roomId = socket.roomId;

    if (!roomId || !drawings[roomId]) {
      return;
    }

    console.log('Undo requested by:', socket.username, 'in room:', roomId);

    // Remove the latest drawing
    // made by this user
    for (var i = drawings[roomId].length - 1; i >= 0; i--) {
      if (drawings[roomId][i].socketId === socket.id) {
        drawings[roomId].splice(i, 1);

        break;
      }
    }

    // Save updated board
    saveWhiteboards();

    // Send updated board to everyone
    io.to(roomId).emit('boardUpdate', drawings[roomId]);
  });

  // ----------------------------------
  // LIVE CURSOR
  // ----------------------------------

  socket.on('cursorMove', function (cursorData) {
    var roomId = socket.roomId;

    if (!roomId) {
      return;
    }

    cursorData.socketId = socket.id;

    // Send cursor only to users
    // in the same room
    socket.to(roomId).emit('cursorMove', cursorData);
  });

  // ----------------------------------
  // DISCONNECT
  // ----------------------------------

  socket.on('disconnect', function () {
    var roomId = socket.roomId;

    console.log('Client disconnected:', socket.id);

    if (!roomId) {
      return;
    }

    // Remove user from room
    if (users[roomId]) {
      delete users[roomId][socket.id];

      io.to(roomId).emit('usersUpdate', users[roomId]);
    }

    // Remove remote cursor
    io.to(roomId).emit('cursorRemove', socket.id);

    // IMPORTANT:
    // We DO NOT delete drawings[roomId].
    //
    // This means the whiteboard remains saved
    // even after everyone leaves.

    if (users[roomId] && Object.keys(users[roomId]).length === 0) {
      delete users[roomId];

      console.log('Everyone left room:', roomId);
    }
  });
});
