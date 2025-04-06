const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const ngrok = require('ngrok');

// Initialize Express app
const app = express();

// Configure CORS for Express routes
app.use(cors({
  origin: true, // Allow all origins
  methods: ['GET', 'POST'],
  credentials: true
}));

// Create HTTP server for local development
const server = http.createServer(app);

// Initialize Socket.IO with enhanced configuration
const io = new Server(server, {
  cors: {
    origin: true, // Allow all origins
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['*']
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  allowUpgrades: true,
  perMessageDeflate: true,
  httpCompression: true,
  maxHttpBufferSize: 1e8
});

// Store waiting users and active connections
let waitingUsers = [];
const activeConnections = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle find partner request
  socket.on('find-partner', () => {
    console.log(`User ${socket.id} is looking for a partner`);
    
    // Remove user from any existing connections
    leaveCurrentChat(socket.id);
    
    // If there's a waiting user, match them
    if (waitingUsers.length > 0) {
      const partnerId = waitingUsers.shift();
      const partnerSocket = io.sockets.sockets.get(partnerId);
      
      if (partnerSocket) {
        // Create a connection between the two users
        activeConnections.set(socket.id, partnerId);
        activeConnections.set(partnerId, socket.id);
        
        // Notify both users about the match
        socket.emit('matched', { initiator: true });
        partnerSocket.emit('matched', { initiator: false });
        
        console.log(`Matched ${socket.id} with ${partnerId}`);
      } else {
        // If partner socket is invalid, add current user to waiting list
        waitingUsers.push(socket.id);
      }
    } else {
      // Add user to waiting list
      waitingUsers.push(socket.id);
    }
  });

  // Handle WebRTC signaling
  socket.on('offer', (offer) => {
    const partnerId = activeConnections.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('offer', offer);
    }
  });

  socket.on('answer', (answer) => {
    const partnerId = activeConnections.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('answer', answer);
    }
  });

  socket.on('ice-candidate', (candidate) => {
    const partnerId = activeConnections.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('ice-candidate', candidate);
    }
  });

  // Handle user leaving chat
  socket.on('leave-chat', () => {
    leaveCurrentChat(socket.id);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    leaveCurrentChat(socket.id);
    
    // Remove user from waiting list if they're in it
    const waitingIndex = waitingUsers.indexOf(socket.id);
    if (waitingIndex !== -1) {
      waitingUsers.splice(waitingIndex, 1);
    }
  });
});

// Helper function to handle a user leaving their current chat
function leaveCurrentChat(userId) {
  const partnerId = activeConnections.get(userId);
  
  if (partnerId) {
    // Notify the partner that this user has disconnected
    io.to(partnerId).emit('partner-disconnected');
    
    // Remove both connections
    activeConnections.delete(userId);
    activeConnections.delete(partnerId);
    
    console.log(`Disconnected ${userId} from ${partnerId}`);
  }
}

// Basic route for testing server status
app.get('/', (req, res) => {
  res.send('Omegle Signaling Server is running');
});

// Function to find an available port
async function findAvailablePort(startPort) {
  const net = require('net');
  
  function isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = net.createServer()
        .once('error', () => resolve(false))
        .once('listening', () => {
          server.close();
          resolve(true);
        })
        .listen(port);
    });
  }

  let port = startPort;
  while (!(await isPortAvailable(port))) {
    port++;
    if (port > startPort + 100) { // Limit port search range
      throw new Error('No available ports found in range');
    }
  }
  return port;
}

// Start the server with port finding and error handling
// Create SSL certificate directory and generate self-signed certificates if they don't exist
// Connect to ngrok and start the server
const startNgrok = async (port) => {
  try {
    const url = await ngrok.connect({
      proto: 'http',
      addr: port,
      bind_tls: true
    });
    console.log(`Ngrok tunnel established at: ${url}`);
    console.log('Share this URL with others to connect to your server');
    return url;
  } catch (error) {
    console.error('Failed to establish ngrok tunnel:', error);
    process.exit(1);
  }
};

const startServer = async () => {
  try {
    const desiredPort = process.env.PORT || 3000;
    const port = await findAvailablePort(desiredPort);
    
    server.listen(port, async () => {
      console.log(`Signaling server running on port ${port}`);
      if (port !== desiredPort) {
        console.log(`Note: Original port ${desiredPort} was in use, using port ${port} instead`);
      }
      // Start ngrok tunnel after server is running
      await startNgrok(port);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is in use, trying another port...`);
        setTimeout(() => {
          server.close();
          // Connect to ngrok and start the server
const startNgrok = async () => {
  try {
    const url = await ngrok.connect({
      proto: 'https',
      addr: process.env.PORT || 3000,
      bind_tls: true
    });
    console.log(`Ngrok tunnel established at: ${url}`);
    console.log('Share this URL with others to connect to your server');
    return url;
  } catch (error) {
    console.error('Failed to establish ngrok tunnel:', error);
    process.exit(1);
  }
};

// Start both the server and ngrok tunnel
(async () => {
  await startServer();
  await startNgrok();
})();
        }, 1000);
      } else {
        console.error('Server error:', error);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();