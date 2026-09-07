import React, { Component } from 'react';
import { io } from 'socket.io-client';

import Board from '../board/Board';
import JoinScreen from '../join/JoinScreen';

import './Container.css';

class Container extends Component {
  constructor(props) {
    super(props);

    var pathname = window.location.pathname;

    var roomId = 'default';

    if (pathname.startsWith('/room/')) {
      var roomFromUrl = pathname.replace('/room/', '').split('/')[0];

      if (roomFromUrl) {
        roomId = roomFromUrl;
      }
    }

    console.log('Room detected from URL:', roomId);

    this.state = {
      username: '',
      joined: false,
      roomId: roomId,

      users: {},
      remoteCursors: {},

      strokeColor: '#000000',
      strokeWidth: 4,
      eraserWidth: 20,

      isEraser: false,
    };

    this.socket = null;
    this.canvasRef = React.createRef();
  }

  componentDidMount() {
    this.socket = io(process.env.REACT_APP_SOCKET_URL);

    this.socket.on('connect', () => {
      console.log('Connected to server:', this.socket.id);
    });

    this.socket.on('usersUpdate', (users) => {
      this.setState({
        users: users,
      });
    });

    this.socket.on('drawToWhiteboard', (drawingData) => {
      if (!this.canvasRef.current || !drawingData || !drawingData.stroke) {
        return;
      }

      this.canvasRef.current.loadPaths([drawingData.stroke]);
    });

    this.socket.on('boardUpdate', (drawings) => {
      if (!this.canvasRef.current) {
        return;
      }

      if (!Array.isArray(drawings)) {
        return;
      }

      var paths = drawings
        .map(function (drawing) {
          return drawing.stroke;
        })
        .filter(function (stroke) {
          return stroke;
        });

      this.canvasRef.current.resetCanvas();

      if (paths.length > 0) {
        this.canvasRef.current.loadPaths(paths);
      }
    });

    this.socket.on('clearBoard', () => {
      if (this.canvasRef.current) {
        this.canvasRef.current.clearCanvas();
      }
    });

    this.socket.on('cursorMove', (cursorData) => {
      if (!cursorData) {
        return;
      }

      this.setState((previousState) => ({
        remoteCursors: {
          ...previousState.remoteCursors,

          [cursorData.socketId]: cursorData,
        },
      }));
    });

    this.socket.on('cursorRemove', (socketId) => {
      this.setState((previousState) => {
        var cursors = {
          ...previousState.remoteCursors,
        };

        delete cursors[socketId];

        return {
          remoteCursors: cursors,
        };
      });
    });
  }

  componentWillUnmount() {
    if (this.socket) {
      this.socket.disconnect();

      this.socket = null;
    }
  }

  handleJoin = (username) => {
    if (!username || !username.trim()) {
      return;
    }

    var cleanUsername = username.trim();

    this.setState(
      {
        username: cleanUsername,
        joined: true,
      },
      () => {
        if (this.socket) {
          this.socket.emit('joinRoom', {
            roomId: this.state.roomId,

            username: this.state.username,
          });
        }
      },
    );
  };

  handleDraw = (stroke, isEraser) => {
    if (!this.socket) {
      return;
    }

    if (!stroke || !Array.isArray(stroke.paths)) {
      return;
    }

    this.socket.emit('drawToWhiteboard', {
      username: this.state.username,

      stroke: stroke,
    });
  };

  handleColorChange = (event) => {
    this.setState({
      strokeColor: event.target.value,

      isEraser: false,
    });

    if (this.canvasRef.current) {
      this.canvasRef.current.eraseMode(false);
    }
  };

  handleStrokeWidthChange = (event) => {
    var value = Number(event.target.value);

    if (this.state.isEraser) {
      this.setState({
        eraserWidth: value,
      });
    } else {
      this.setState({
        strokeWidth: value,
      });
    }
  };

  handlePenMode = () => {
    this.setState({
      isEraser: false,
    });

    if (this.canvasRef.current) {
      this.canvasRef.current.eraseMode(false);
    }
  };

  handleEraserMode = () => {
    this.setState({
      isEraser: true,
    });

    if (this.canvasRef.current) {
      this.canvasRef.current.eraseMode(true);
    }
  };

  handleUndo = () => {
    if (!this.socket) {
      return;
    }

    this.socket.emit('undo');
  };

  handleClear = () => {
    if (!this.socket) {
      return;
    }

    var confirmed = window.confirm('Clear the whiteboard for everyone?');

    if (!confirmed) {
      return;
    }

    this.socket.emit('clearBoard');
  };

  handleMouseMove = (event) => {
    if (!this.socket || !this.state.joined) {
      return;
    }

    var rect = event.currentTarget.getBoundingClientRect();

    var x = event.clientX - rect.left;

    var y = event.clientY - rect.top;

    this.socket.emit('cursorMove', {
      x: x,
      y: y,

      username: this.state.username,
    });
  };

  render() {
    if (!this.state.joined) {
      return <JoinScreen onJoin={this.handleJoin} />;
    }

    return (
      <div className="container">
        {/* TOP BAR */}

        <div className="top-bar">
          <div className="title-section">
            <h1>Collaborative Whiteboard</h1>

            <span>Room: {this.state.roomId}</span>
          </div>

          <div className="users-section">
            <span className="online-label">
              <span className="online-dot"></span>
              Online
            </span>

            <div className="user-list">
              {Object.values(this.state.users).map((user, index) => (
                <span className="user-badge" key={index}>
                  {user}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* TOOLBAR */}

        <div className="toolbar">
          <div className="tool-group">
            <label>Color</label>

            <input
              type="color"
              value={this.state.strokeColor}
              disabled={this.state.isEraser}
              onChange={this.handleColorChange}
            />
          </div>

          <div className="tool-group size-group">
            <label>
              {this.state.isEraser ? 'Eraser' : 'Size'}{' '}
              {this.state.isEraser
                ? this.state.eraserWidth
                : this.state.strokeWidth}
            </label>

            <input
              type="range"
              min="1"
              max={this.state.isEraser ? '50' : '20'}
              value={
                this.state.isEraser
                  ? this.state.eraserWidth
                  : this.state.strokeWidth
              }
              onChange={this.handleStrokeWidthChange}
            />
          </div>

          <button
            className={
              !this.state.isEraser ? 'tool-button active-tool' : 'tool-button'
            }
            onClick={this.handlePenMode}
          >
            ✏️ Pen
          </button>

          <button
            className={
              this.state.isEraser
                ? 'tool-button active-tool eraser-active'
                : 'tool-button'
            }
            onClick={this.handleEraserMode}
          >
            🧹 Eraser
          </button>

          <button className="tool-button" onClick={this.handleUndo}>
            ↩️ Undo
          </button>

          <button
            className="tool-button clear-button"
            onClick={this.handleClear}
          >
            🗑️ Clear
          </button>
        </div>

        {/* WHITEBOARD */}

        <div className="board-wrapper" onMouseMove={this.handleMouseMove}>
          <Board
            ref={this.canvasRef}
            strokeColor={this.state.strokeColor}
            strokeWidth={this.state.strokeWidth}
            eraserWidth={this.state.eraserWidth}
            onDraw={this.handleDraw}
          />

          {/* REMOTE CURSORS */}

          {Object.entries(this.state.remoteCursors).map(
            ([socketId, cursor]) => (
              <div
                key={socketId}
                className="remote-cursor"
                style={{
                  left: cursor.x,

                  top: cursor.y,
                }}
              >
                <span>✏️</span>

                <small>{cursor.username}</small>
              </div>
            ),
          )}
        </div>
      </div>
    );
  }
}

export default Container;
