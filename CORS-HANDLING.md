# CORS Handling in Omegle Clone

## Overview

This document explains how to handle Cross-Origin Resource Sharing (CORS) issues that may arise when developing or deploying the Omegle clone application.

## Problem Description

The error message:
```
Access to XMLHttpRequest at 'https://omegle-server-production.up.railway.app/socket.io/?EIO=4&transport=polling&t=7nm449x2' from origin 'https://localhost:4200' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

This occurs because the browser enforces a security policy that prevents a web page from making requests to a different domain than the one that served the web page, unless the server explicitly allows it through CORS headers.

## Solutions

### 1. Development Environment

For local development, we've implemented several solutions:

#### Using Angular Dev Server Proxy

The application is configured with a proxy that forwards requests to the backend server, bypassing CORS restrictions:

1. A `proxy.conf.json` file is included in the project root
2. The `start` script in `package.json` uses this proxy configuration
3. Run the application with `npm start` to use the proxy

#### SSL for Local Development

WebRTC requires secure contexts (HTTPS) to work properly. The start script includes the `--ssl true` flag to serve the application over HTTPS locally.

### 2. Server-Side Configuration

If you're running your own server, ensure it has proper CORS headers:

```javascript
// Example for Express.js server
const cors = require('cors');

app.use(cors({
  origin: ['https://your-client-domain.com', 'http://localhost:4200'],
  methods: ['GET', 'POST'],
  credentials: true
}));
```

### 3. Fallback Mechanisms

The application includes fallback mechanisms when the signaling server is unreachable:

- Multiple connection retry attempts
- Fallback to alternative server URLs
- Direct WebRTC connection attempts using public STUN/TURN servers
- Comprehensive error handling with user-friendly messages

## Troubleshooting

If you encounter CORS issues:

1. Check browser console for specific error messages
2. Ensure you're running the application with `npm start` to use the proxy
3. Verify the server is properly configured with CORS headers
4. Try using a browser extension that disables CORS for testing (not recommended for production)

## References

- [MDN Web Docs: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Angular Dev Server Proxy](https://angular.io/guide/build#proxying-to-a-backend-server)
- [WebRTC Security](https://webrtc.org/getting-started/overview#security)