Real-Time Collaborative Whiteboard

A real-time collaborative whiteboard that allows multiple users to join the same room and draw together. Drawing changes are synchronized instantly using Socket.IO.

The application also includes an AI Whiteboard Assistant powered by Google Gemini that can analyze the whiteboard and provide explanations, summaries, and improvement suggestions.

Live Demo

Frontend:  
https://collaborative-whiteboard-eosin-psi.vercel.app

Backend:  
https://collaborative-whiteboard-o9vu.onrender.com

Features

Collaborative Whiteboard

- Real-time collaborative drawing
- Room-based collaboration
- Multiple users can work on the same whiteboard
- Username and online-user presence
- Live remote cursors
- User-specific undo
- Clear whiteboard for everyone in the room
- Persistent whiteboard state using JSON storage

Drawing Tools

- Custom drawing colors
- Adjustable stroke width
- Eraser mode
- Adjustable eraser width
- Responsive canvas
- Dark-themed interface

AI Whiteboard Assistant

The application integrates Google Gemini to analyze the whiteboard image.

The AI Assistant provides three operations:

- Explain — explains the diagram, concepts, relationships, and flow visible on the whiteboard
- Summarize — provides a concise summary of the whiteboard
- Improve — identifies possible improvements and missing elements in the diagram

The AI integration also includes retry and fallback handling for temporary Gemini model availability issues.

Tech Stack

Frontend

- React
- React Sketch Canvas
- Socket.IO Client
- CSS

Backend

- Node.js
- Express
- Socket.IO
- File System
- JSON persistence

AI

- Google Gemini API
- `@google/genai`

Deployment

- Vercel — Frontend
- Render — Backend
- GitHub — Source Control

Architecture

```text
                    ┌─────────────────────┐
                    │      React App      │
                    │      (Vercel)       │
                    └──────────┬──────────┘
                               │
                     Socket.IO / HTTP
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Node.js + Express │
                    │      (Render)        │
                    └───────┬───────┬─────┘
                            │       │
                  Socket.IO │       │ Gemini API
                            │       │
                            ▼       ▼
                    ┌──────────┐  ┌─────────────┐
                    │  Rooms & │  │   Google    │
                    │ Drawings │  │   Gemini AI  │
                    └──────────┘  └─────────────┘
                            │
                            ▼
                    ┌─────────────────┐
                    │ JSON Persistence│
                    └─────────────────┘
```
