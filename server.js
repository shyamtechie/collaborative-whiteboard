var PORT = process.env.PORT || 8080;

var express = require('express');
var fs = require('fs');
var path = require('path');

var app = express();

app.use(express.static(__dirname + '/public'));

var server = require('http').Server(app);

var io = require('socket.io')(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

var users = {};
var drawings = {};

var dataFile = path.join(__dirname, 'temp', 'whiteboards.json');

// Load saved whiteboards
if (fs.existsSync(dataFile)) {
  try {
    drawings = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

    console.log('Saved whiteboards loaded');
  } catch (error) {
    console.log('Could not load saved whiteboards');
    drawings = {};
  }
}

// Save whiteboards to JSON file
function saveWhiteboards() {
  fs.writeFileSync(dataFile, JSON.stringify(drawings, null, 2), 'utf8');
}

// Start server
server.listen(PORT, '0.0.0.0', function () {
  console.log('Webserver & socketserver running on port: ' + PORT);
});

// Socket.IO connection
io.on('connection', function (socket) {
  console.log('Client connected:', socket.id);

  // ==============================
  // JOIN ROOM
  // ==============================

  socket.on('joinRoom', function (data) {
    var roomId = data.roomId;
    var username = data.username;

    console.log(username + ' joined room ' + roomId);

    socket.join(roomId);

    socket.roomId = roomId;
    socket.username = username;

    // Create users object for room
    if (!users[roomId]) {
      users[roomId] = {};
    }

    users[roomId][socket.id] = username;

    // Create drawings array for room
    if (!drawings[roomId]) {
      drawings[roomId] = [];
    }

    // Send updated users list
    io.to(roomId).emit('usersUpdate', users[roomId]);

    // Send existing drawings to newly joined user
    socket.emit('boardUpdate', drawings[roomId]);
  });

  // ==============================
  // DRAW
  // ==============================

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

    // Save drawing
    drawings[roomId].push(drawing);

    // Persist drawing
    saveWhiteboards();

    console.log('Drawing received from:', socket.username, 'in room:', roomId);

    // Send drawing to other users
    socket.to(roomId).emit('drawToWhiteboard', drawingData);
  });

  // ==============================
  // CLEAR BOARD
  // ==============================

  socket.on('clearBoard', function () {
    var roomId = socket.roomId;

    if (!roomId) {
      return;
    }

    console.log('Whiteboard cleared in room:', roomId);

    drawings[roomId] = [];

    saveWhiteboards();

    // Clear board for everyone
    io.to(roomId).emit('clearBoard');
  });

  // ==============================
  // UNDO
  // ==============================

  socket.on('undo', function () {
    var roomId = socket.roomId;

    if (!roomId || !drawings[roomId]) {
      return;
    }

    console.log('Undo requested by:', socket.username, 'in room:', roomId);

    // Find the latest drawing
    // made by this user
    for (var i = drawings[roomId].length - 1; i >= 0; i--) {
      if (drawings[roomId][i].socketId === socket.id) {
        drawings[roomId].splice(i, 1);

        break;
      }
    }

    saveWhiteboards();

    // Send updated board to everyone
    io.to(roomId).emit('boardUpdate', drawings[roomId]);
  });

  // ==============================
  // CURSOR MOVE
  // ==============================

  socket.on('cursorMove', function (cursorData) {
    var roomId = socket.roomId;

    if (!roomId) {
      return;
    }

    cursorData.socketId = socket.id;

    // Send cursor position
    // to other users in the room
    socket.to(roomId).emit('cursorMove', cursorData);
  });

  // ==============================
  // DISCONNECT
  // ==============================

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

    // Remove cursor
    io.to(roomId).emit('cursorRemove', socket.id);

    // IMPORTANT:
    // Do not delete drawings.
    // Whiteboard data remains saved
    // even after everyone leaves.

    if (users[roomId] && Object.keys(users[roomId]).length === 0) {
      delete users[roomId];

      console.log('Everyone left room:', roomId);
    }
  });
});
