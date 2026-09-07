# Real-Time Collaborative Whiteboard

A real-time collaborative whiteboard where multiple users can join the same room and draw together. Changes are synchronized instantly using Socket.IO, with support for user presence, live cursors, undo, clearing the board, and persistent whiteboard state.

## Features

- 🎨 Real-time collaborative drawing
- 🏠 Room-based collaboration
- 👥 Username and online-user presence
- ✏️ Live remote cursors
- ↩️ User-specific undo
- 🗑️ Clear whiteboard for everyone in the room
- 💾 Persistent whiteboard state using JSON storage
- 🎨 Custom drawing colors
- 📏 Adjustable stroke width
- 🌙 Responsive dark-themed interface

## Tech Stack

### Frontend
- React
- React Sketch Canvas
- Socket.IO Client
- CSS

### Backend
- Node.js
- Express
- Socket.IO
- File System (JSON persistence)

## Project Structure

```text
collaborative-whiteboard/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── board/
│   │   │   │   ├── Board.jsx
│   │   │   │   └── style.css
│   │   │   │
│   │   │   ├── container/
│   │   │   │   ├── Container.jsx
│   │   │   │   └── Container.css
│   │   │   │
│   │   │   └── join/
│   │   │       ├── JoinScreen.jsx
│   │   │       └── JoinScreen.css
│   │   │
│   │   ├── App.js
│   │   └── index.js
│   │
│   └── package.json
│
├── server.js
├── temp/
│   └── .gitkeep
│
├── .gitignore
└── README.md