import React from 'react';
import io from 'socket.io-client';

import Board from '../board/Board';
import JoinScreen from '../join/JoinScreen';

import './Container.css';

class Container extends React.Component {
	constructor(props) {
		super(props);

		/* =========================================
           GET ROOM FROM URL
        ========================================= */

		var pathname = window.location.pathname;

		var roomId = 'default';

		if (pathname.startsWith('/room/')) {
			var roomFromUrl = pathname.replace('/room/', '').split('/')[0];

			if (roomFromUrl) {
				roomId = roomFromUrl;
			}
		}

		console.log('Room detected from URL:', roomId);

		/* =========================================
           STATE
        ========================================= */

		this.state = {
			roomId: roomId,

			username: '',

			joined: false,

			users: {},

			cursors: {},

			strokeColor: '#000000',

			strokeWidth: 3,

			/*
			 * Drawings received before the canvas
			 * is completely ready.
			 */
			pendingDrawings: [],
		};

		/* =========================================
           REFS
        ========================================= */

		this.socket = io('http://localhost:8080');

		this.canvasRef = React.createRef();

		this.boardContainerRef = React.createRef();

		/* =========================================
           SOCKET EVENTS
        ========================================= */

		this.socket.on('connect', () => {
			console.log('Socket connected:', this.socket.id);

			console.log('Current room:', this.state.roomId);
		});

		/* =========================================
           USERS UPDATE
        ========================================= */

		this.socket.on('usersUpdate', (users) => {
			console.log('Users updated:', users);

			this.setState({
				users: users,
			});
		});

		/* =========================================
           NEW DRAWING
        ========================================= */

		this.socket.on('drawToWhiteboard', (drawingData) => {
			console.log('RECEIVED DRAWING FROM SERVER:', drawingData);

			if (this.canvasRef.current && drawingData && drawingData.stroke) {
				this.canvasRef.current.loadPaths([drawingData.stroke]);
			} else {
				/*
				 * Canvas isn't ready yet.
				 * Store drawing temporarily.
				 */
				this.setState(function (previousState) {
					return {
						pendingDrawings: previousState.pendingDrawings.concat([
							drawingData.stroke,
						]),
					};
				});
			}
		});

		/* =========================================
           COMPLETE BOARD UPDATE
           Used for initial loading / undo
        ========================================= */

		this.socket.on('boardUpdate', (drawings) => {
			console.log('BOARD UPDATE RECEIVED:', drawings);

			if (this.canvasRef.current) {
				this.loadDrawings(drawings);
			} else {
				this.setState({
					pendingDrawings: drawings.map(function (drawing) {
						return drawing.stroke;
					}),
				});
			}
		});

		/* =========================================
           CLEAR BOARD
        ========================================= */

		this.socket.on('clearBoard', () => {
			console.log('CLEAR BOARD RECEIVED');

			if (this.canvasRef.current) {
				this.canvasRef.current.clearCanvas();
			}
		});

		/* =========================================
           REMOTE CURSOR
        ========================================= */

		this.socket.on('cursorMove', (cursorData) => {
			if (!cursorData || !cursorData.socketId) {
				return;
			}

			this.setState(function (previousState) {
				return {
					cursors: {
						...previousState.cursors,

						[cursorData.socketId]: cursorData,
					},
				};
			});
		});

		/* =========================================
           REMOVE REMOTE CURSOR
        ========================================= */

		this.socket.on('cursorRemove', (socketId) => {
			this.setState(function (previousState) {
				var cursors = {
					...previousState.cursors,
				};

				delete cursors[socketId];

				return {
					cursors: cursors,
				};
			});
		});
	}

	/* =========================================
       LOAD DRAWINGS
    ========================================= */

	loadDrawings = (drawings) => {
		if (!this.canvasRef.current) {
			return;
		}

		if (!drawings || drawings.length === 0) {
			return;
		}

		var paths = drawings
			.map(function (drawing) {
				if (drawing && drawing.stroke) {
					return drawing.stroke;
				}

				return null;
			})
			.filter(function (stroke) {
				return stroke !== null;
			});

		if (paths.length > 0) {
			this.canvasRef.current.loadPaths(paths);

			console.log('Loaded drawings:', paths.length);
		}
	};

	/* =========================================
       COMPONENT MOUNTED
    ========================================= */

	componentDidMount() {
		console.log('CONTAINER COMPONENT LOADED');
	}

	/* =========================================
       COMPONENT UPDATED
    ========================================= */

	componentDidUpdate(previousProps, previousState) {
		/*
		 * User just joined.
		 * Give the canvas time to render,
		 * then load any pending drawings.
		 */
		if (!previousState.joined && this.state.joined) {
			setTimeout(() => {
				console.log('Canvas ready. Loading pending drawings.');

				if (
					this.state.pendingDrawings.length > 0 &&
					this.canvasRef.current
				) {
					this.canvasRef.current.loadPaths(
						this.state.pendingDrawings,
					);

					this.setState({
						pendingDrawings: [],
					});
				}
			}, 500);
		}
	}

	/* =========================================
       USERNAME CHANGE
    ========================================= */

	handleUsernameChange = (event) => {
		this.setState({
			username: event.target.value,
		});
	};

	/* =========================================
       JOIN ROOM
    ========================================= */

	handleJoin = () => {
		var username = this.state.username.trim();

		if (!username) {
			alert('Please enter your name');

			return;
		}

		console.log('JOINING ROOM:', this.state.roomId);

		console.log('USERNAME:', username);

		this.socket.emit('joinRoom', {
			roomId: this.state.roomId,

			username: username,
		});

		this.setState({
			username: username,
			joined: true,
		});
	};

	/* =========================================
       DRAW HANDLER
    ========================================= */

	handleDraw = (stroke) => {
		console.log('HANDLE DRAW CALLED');

		if (!stroke) {
			return;
		}

		var drawingData = {
			username: this.state.username,

			stroke: stroke,
		};

		console.log('DRAWING SENT TO SERVER:', drawingData);

		this.socket.emit('drawToWhiteboard', drawingData);
	};

	/* =========================================
       CLEAR BOARD
    ========================================= */

	handleClear = () => {
		console.log('CLEAR BUTTON CLICKED');

		this.socket.emit('clearBoard');
	};

	/* =========================================
       UNDO
    ========================================= */

	handleUndo = () => {
		console.log('UNDO BUTTON CLICKED');

		this.socket.emit('undo');
	};

	/* =========================================
       COLOR CHANGE
    ========================================= */

	handleColorChange = (event) => {
		this.setState({
			strokeColor: event.target.value,
		});
	};

	/* =========================================
       WIDTH CHANGE
    ========================================= */

	handleWidthChange = (event) => {
		this.setState({
			strokeWidth: Number(event.target.value),
		});
	};

	/* =========================================
       CURSOR MOVE
    ========================================= */

	handleCursorMove = (event) => {
		if (!this.boardContainerRef.current) {
			return;
		}

		var rect = this.boardContainerRef.current.getBoundingClientRect();

		var x = event.clientX - rect.left;

		var y = event.clientY - rect.top;

		this.socket.emit('cursorMove', {
			username: this.state.username,

			x: x,

			y: y,
		});
	};

	/* =========================================
       RENDER REMOTE CURSORS
    ========================================= */

	renderCursors = () => {
		var cursors = this.state.cursors;

		return Object.keys(cursors).map((socketId) => {
			var cursor = cursors[socketId];

			return (
				<div
					key={socketId}
					className="remote-cursor"
					style={{
						left: cursor.x,

						top: cursor.y,
					}}
				>
					<span>✏️</span>

					<span>{cursor.username}</span>
				</div>
			);
		});
	};

	/* =========================================
       RENDER
    ========================================= */

	render() {
		/* =====================================
           JOIN SCREEN
        ===================================== */

		if (!this.state.joined) {
			return (
				<JoinScreen
					roomId={this.state.roomId}
					username={this.state.username}
					onUsernameChange={this.handleUsernameChange}
					onJoin={this.handleJoin}
				/>
			);
		}

		/* =====================================
           WHITEBOARD
        ===================================== */

		return (
			<div className="container">
				{/* =================================
                    TOOLBAR
                ================================= */}

				<div className="tool-bar-container">
					{/* TITLE */}

					<div className="toolbar-title">✦ Whiteboard</div>

					{/* ROOM */}

					<div className="room-info">
						<span>Room:</span>

						<strong>{this.state.roomId}</strong>
					</div>

					{/* ONLINE USERS */}

					<div className="online-users">
						<span>
							● {Object.keys(this.state.users).length} Online
						</span>

						<div className="user-list">
							{Object.keys(this.state.users).map((socketId) => (
								<span key={socketId} className="user-name">
									{this.state.users[socketId]}
								</span>
							))}
						</div>
					</div>

					{/* COLOR */}

					<label>
						Color
						<input
							type="color"
							value={this.state.strokeColor}
							onChange={this.handleColorChange}
						/>
					</label>

					{/* WIDTH */}

					<label>
						Width
						<input
							type="range"
							min="1"
							max="20"
							value={this.state.strokeWidth}
							onChange={this.handleWidthChange}
						/>
						<span>{this.state.strokeWidth}</span>
					</label>

					{/* UNDO */}

					<button onClick={this.handleUndo}>↩ Undo</button>

					{/* CLEAR */}

					<button onClick={this.handleClear}>🗑 Clear</button>
				</div>

				{/* =================================
                    BOARD
                ================================= */}

				<div
					className="board-container"
					ref={this.boardContainerRef}
					onMouseMove={this.handleCursorMove}
				>
					<Board
						ref={this.canvasRef}
						strokeColor={this.state.strokeColor}
						strokeWidth={this.state.strokeWidth}
						onDraw={this.handleDraw}
					/>

					{/* REMOTE CURSORS */}

					{this.renderCursors()}
				</div>
			</div>
		);
	}
}

export default Container;
