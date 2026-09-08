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

      aiOpen: false,
      aiLoading: false,
      aiAction: '',
      aiResult: '',
      aiError: '',
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
      isEraser: isEraser,
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

  /*
   * ----------------------------------------------------
   * AI ASSISTANT
   * ----------------------------------------------------
   */

  openAI = () => {
    this.setState({
      aiOpen: true,
      aiLoading: false,
      aiResult: '',
      aiError: '',
      aiAction: '',
    });
  };

  closeAI = () => {
    if (this.state.aiLoading) {
      return;
    }

    this.setState({
      aiOpen: false,
      aiLoading: false,
      aiResult: '',
      aiError: '',
      aiAction: '',
    });
  };

  handleAI = async (action) => {
    if (!this.canvasRef.current) {
      console.error('Canvas reference not available.');
      return;
    }

    console.log('========== AI REQUEST START ==========');

    console.log('AI action:', action);

    this.setState({
      aiLoading: true,
      aiAction: action,
      aiResult: '',
      aiError: '',
    });

    var timeoutId = null;

    try {
      /*
       * Export current whiteboard
       */

      console.log('Exporting whiteboard image...');

      var image = await this.canvasRef.current.exportImage();

      if (!image) {
        throw new Error('Could not export the whiteboard.');
      }

      console.log('Whiteboard image exported successfully.');

      /*
       * Backend URL
       */

      var backendUrl = process.env.REACT_APP_SOCKET_URL;

      if (!backendUrl) {
        throw new Error('REACT_APP_SOCKET_URL is not configured.');
      }

      var apiUrl = backendUrl + '/api/ai/analyze';

      console.log('AI API URL:', apiUrl);

      /*
       * Create timeout
       */

      var controller = new AbortController();

      timeoutId = setTimeout(() => {
        console.error('AI request timed out.');

        controller.abort();
      }, 60000);

      /*
       * Send request
       */

      console.log('Sending whiteboard image to backend...');

      var response = await fetch(apiUrl, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          image: image,
          action: action,
        }),

        signal: controller.signal,
      });

      console.log('Backend response received.', response.status);

      /*
       * Read response as TEXT first.
       *
       * This is intentionally safer than directly
       * calling response.json().
       */

      var responseText = await response.text();

      console.log('Backend response body:', responseText);

      if (!responseText) {
        throw new Error('The AI server returned an empty response.');
      }

      var data;

      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Could not parse backend response:', parseError);

        throw new Error('The AI server returned an invalid response.');
      }

      /*
       * Backend error
       */

      if (!response.ok) {
        var backendError =
          data && data.error ? data.error : 'AI request failed.';

        if (typeof backendError === 'object') {
          backendError = backendError.message || JSON.stringify(backendError);
        }

        throw new Error(backendError);
      }

      /*
       * Successful response
       */

      var result = data && data.result ? data.result : '';

      console.log('AI result received:', result);

      if (!result) {
        throw new Error(
          'AI responded successfully, but no result was returned.',
        );
      }

      /*
       * Update React state
       */

      this.setState({
        aiLoading: false,
        aiResult: result,
        aiError: '',
      });

      console.log('AI result displayed successfully.');
    } catch (error) {
      console.error('========== AI REQUEST ERROR ==========');

      console.error(error);

      var errorMessage = 'Something went wrong while analyzing the whiteboard.';

      if (error && error.name === 'AbortError') {
        errorMessage = 'The AI request took too long. Please try again.';
      } else if (error && error.message) {
        errorMessage = error.message;
      }

      this.setState({
        aiLoading: false,
        aiResult: '',
        aiError: errorMessage,
      });
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      /*
       * Safety check:
       *
       * Never leave the UI permanently stuck
       * in "Analyzing whiteboard..."
       */

      this.setState((previousState) => {
        if (previousState.aiLoading && previousState.aiError) {
          return {
            aiLoading: false,
          };
        }

        return null;
      });

      console.log('========== AI REQUEST END ==========');
    }
  };

  /*
   * ----------------------------------------------------
   * AI MARKDOWN FORMATTER
   * ----------------------------------------------------
   */

  renderInlineMarkdown = (text) => {
    var parts = text.split(/(\*\*.*?\*\*|`.*?`)/);

    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }

      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={index} className="ai-inline-code">
            {part.slice(1, -1)}
          </code>
        );
      }

      return <React.Fragment key={index}>{part}</React.Fragment>;
    });
  };

  renderAIText = (text) => {
    if (!text) {
      return null;
    }

    var lines = text.split('\n');

    return (
      <div className="ai-formatted-content">
        {lines.map((line, index) => {
          var trimmed = line.trim();

          /*
           * Empty line
           */

          if (!trimmed) {
            return <div key={index} className="ai-spacer"></div>;
          }

          /*
           * Headings
           */

          if (trimmed.startsWith('### ')) {
            return (
              <h3 key={index} className="ai-markdown-heading">
                {this.renderInlineMarkdown(trimmed.slice(4))}
              </h3>
            );
          }

          if (trimmed.startsWith('## ')) {
            return (
              <h3 key={index} className="ai-markdown-heading">
                {this.renderInlineMarkdown(trimmed.slice(3))}
              </h3>
            );
          }

          if (trimmed.startsWith('# ')) {
            return (
              <h3 key={index} className="ai-markdown-heading">
                {this.renderInlineMarkdown(trimmed.slice(2))}
              </h3>
            );
          }

          /*
           * Horizontal rule
           */

          if (trimmed === '---' || trimmed === '***') {
            return <hr key={index} className="ai-divider" />;
          }

          /*
           * Bullet point
           */

          if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
            return (
              <div key={index} className="ai-bullet">
                <span>•</span>

                <div>{this.renderInlineMarkdown(trimmed.slice(2))}</div>
              </div>
            );
          }

          /*
           * Numbered list
           */

          var numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);

          if (numberedMatch) {
            return (
              <div key={index} className="ai-numbered-item">
                <span className="ai-number">{numberedMatch[1]}</span>

                <div>{this.renderInlineMarkdown(numberedMatch[2])}</div>
              </div>
            );
          }

          /*
           * Normal paragraph
           */

          return (
            <p key={index} className="ai-paragraph">
              {this.renderInlineMarkdown(trimmed)}
            </p>
          );
        })}
      </div>
    );
  };

  renderAI = () => {
    if (!this.state.aiOpen) {
      return null;
    }

    return (
      <div className="ai-overlay">
        <div className="ai-panel">
          {/* AI HEADER */}

          <div className="ai-header">
            <div>
              <h2>🤖 AI Whiteboard Assistant</h2>

              <p>Analyze your current whiteboard with AI</p>
            </div>

            <button
              className="ai-close-button"
              onClick={this.closeAI}
              disabled={this.state.aiLoading}
            >
              ✕
            </button>
          </div>

          {/* AI ACTIONS */}

          <div className="ai-actions">
            <button
              className={
                this.state.aiAction === 'explain'
                  ? 'ai-action-button ai-action-selected'
                  : 'ai-action-button'
              }
              onClick={() => this.handleAI('explain')}
              disabled={this.state.aiLoading}
            >
              <span>🧠</span>

              <div>
                <strong>Explain</strong>

                <small>Understand the diagram</small>
              </div>
            </button>

            <button
              className={
                this.state.aiAction === 'summarize'
                  ? 'ai-action-button ai-action-selected'
                  : 'ai-action-button'
              }
              onClick={() => this.handleAI('summarize')}
              disabled={this.state.aiLoading}
            >
              <span>📝</span>

              <div>
                <strong>Summarize</strong>

                <small>Get the main points</small>
              </div>
            </button>

            <button
              className={
                this.state.aiAction === 'improve'
                  ? 'ai-action-button ai-action-selected'
                  : 'ai-action-button'
              }
              onClick={() => this.handleAI('improve')}
              disabled={this.state.aiLoading}
            >
              <span>✨</span>

              <div>
                <strong>Improve</strong>

                <small>Get design suggestions</small>
              </div>
            </button>
          </div>

          {/* LOADING */}

          {this.state.aiLoading && (
            <div className="ai-loading">
              <div className="ai-spinner"></div>

              <div>
                <strong>Analyzing whiteboard...</strong>

                <p>AI is looking at your current drawing.</p>
              </div>
            </div>
          )}

          {/* ERROR */}

          {!this.state.aiLoading && this.state.aiError && (
            <div className="ai-error">
              <strong>AI request failed</strong>

              <p>{this.state.aiError}</p>
            </div>
          )}

          {/* RESULT */}

          {!this.state.aiLoading && this.state.aiResult && (
            <div className="ai-result">
              <div className="ai-result-title">
                <span>
                  {this.state.aiAction === 'explain' && '🧠 Explanation'}

                  {this.state.aiAction === 'summarize' && '📝 Summary'}

                  {this.state.aiAction === 'improve' && '✨ Improvements'}
                </span>
              </div>

              <div className="ai-result-content">
                {this.renderAIText(this.state.aiResult)}
              </div>
            </div>
          )}

          {/* EMPTY STATE */}

          {!this.state.aiLoading &&
            !this.state.aiResult &&
            !this.state.aiError && (
              <div className="ai-empty">
                <div className="ai-empty-icon">🤖</div>

                <h3>Ask AI about your whiteboard</h3>

                <p>
                  Choose an action above and AI will analyze the current board.
                </p>
              </div>
            )}
        </div>
      </div>
    );
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

          <button className="tool-button ai-tool-button" onClick={this.openAI}>
            🤖 AI Assistant
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

        {/* AI PANEL */}

        {this.renderAI()}
      </div>
    );
  }
}

export default Container;
