# Video Chat Application

A real-time video chat application built with Angular and WebRTC, enabling random video chat connections between users.

## Tech Stack

- **Frontend**: Angular 19.2
- **Backend**: Node.js with Express
- **Real-time Communication**: Socket.IO
- **Video Streaming**: WebRTC
- **SSL/Security**: HTTPS enabled for secure connections

## Prerequisites

- Node.js (Latest LTS version)
- Angular CLI v19.2.5
- SSL certificate for local development (included)

## Project Setup

1. Install dependencies for both client and server:

```bash
# Install client dependencies
npm install

# Install server dependencies
cd server
npm install
```

## Development Server

1. Start the Angular development server:

```bash
npm start
```

This will launch the application with SSL enabled and proxy configuration at `https://localhost:4200/`

2. Start the backend server:

```bash
cd server
node server.js
```

The server will start on the configured port with WebSocket support.

## Building for Production

To create a production build:

```bash
npm run build
```

The build artifacts will be stored in the `dist/` directory.

## Deployment

### Frontend Deployment (Netlify)

1. Create a new site on Netlify
2. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `dist/client/browser`
3. Configure environment variables if needed
4. Deploy!

### Backend Deployment (ngrok)

To expose your local server to the internet using ngrok:

1. Install ngrok globally:
```bash
npm install -g ngrok
```

2. Start your server locally

3. Create a tunnel:
```bash
ngrok http <your-server-port>
```

4. Update the frontend configuration to use the ngrok URL

## How It Works

1. **User Connection**:
   - Users connect to the application
   - Socket.IO establishes a real-time connection

2. **Matching Process**:
   - Users enter the waiting pool
   - Server pairs random users together

3. **Video Chat**:
   - WebRTC establishes peer-to-peer connection
   - Video/Audio streams are exchanged directly between users
   - Socket.IO handles signaling and ICE candidate exchange

## Features

- Random user matching
- Real-time video chat
- Secure WebRTC connections
- Automatic peer discovery
- SSL encryption
- Cross-browser compatibility

## Testing

- Run unit tests: `npm test`
- Run end-to-end tests: `ng e2e`

## Additional Resources

- [Angular Documentation](https://angular.dev/)
- [WebRTC Web APIs](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [Netlify Deployment Guide](https://docs.netlify.com/)
- [ngrok Documentation](https://ngrok.com/docs/)
