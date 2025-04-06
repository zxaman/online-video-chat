# Omegle Clone Signaling Server

This is a custom Socket.IO signaling server for the Omegle clone application. It handles user matching, WebRTC signaling (exchanging offers, answers, and ICE candidates), and proper CORS configuration to allow connections from the Angular client.

## Features

- User matching for random video chat
- WebRTC signaling (offers, answers, ICE candidates)
- CORS configuration for local development
- Reliable connection handling

## Installation

```bash
npm install
```

## Running the Server

```bash
npm start
```

Or for development with auto-restart:

```bash
npm run dev
```

The server will run on port 3000 by default. You can change this by setting the PORT environment variable.

## How It Works

1. The server maintains a list of waiting users
2. When a user requests to find a partner, they're either matched with a waiting user or added to the waiting list
3. Once matched, the server facilitates WebRTC signaling between the two users
4. The server handles disconnections and notifies partners when their chat partner disconnects

## API

### Socket.IO Events

- `find-partner`: Request to find a random chat partner
- `offer`: Send a WebRTC offer to a partner
- `answer`: Send a WebRTC answer to a partner
- `ice-candidate`: Send an ICE candidate to a partner
- `leave-chat`: Leave the current chat
- `matched`: Received when matched with a partner
- `partner-disconnected`: Received when a partner disconnects