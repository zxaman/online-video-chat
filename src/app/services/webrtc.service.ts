import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { io, Socket } from 'socket.io-client';

@Injectable({
  providedIn: 'root'
})
export class WebRTCService {
  private socket!: Socket;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private _pendingIceCandidates: RTCIceCandidate[] = [];
  
  private remoteStreamSubject = new BehaviorSubject<MediaStream | null>(null);
  remoteStream$ = this.remoteStreamSubject.asObservable();
  private connectionStateSubject = new BehaviorSubject<boolean>(false);
  connectionState$ = this.connectionStateSubject.asObservable();

  // Configuration with STUN/TURN servers
  private configuration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      // Add public TURN servers as fallback
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ],
    iceCandidatePoolSize: 10,  // Increase candidate pool for better connectivity
    iceTransportPolicy: 'all', // Allow both relay and direct connections
    rtcpMuxPolicy: 'require'   // Required for modern WebRTC implementations
  };

  // Server status tracking
  private serverAvailable = true;
  private serverCheckInterval: any = null;

  constructor() {
    this.initializeSocketConnection();
    this.startServerAvailabilityCheck();
  }
  
  // Periodically check server availability with improved reconnection logic
  private startServerAvailabilityCheck() {
    // Clear any existing interval
    if (this.serverCheckInterval) {
      clearInterval(this.serverCheckInterval);
    }
    
    // Track consecutive failures for exponential backoff
    let consecutiveFailures = 0;
    
    // Check server availability more frequently (every 5 seconds)
    this.serverCheckInterval = setInterval(() => {
      if (!this.socket || !this.socket.connected) {
        consecutiveFailures++;
        console.log(`Server connection check: Not connected (attempt ${consecutiveFailures}). Attempting reconnection...`);
        this.serverAvailable = false;
        
        // Implement exponential backoff for reconnection attempts
        if (consecutiveFailures > 3) {
          console.log('Multiple reconnection failures. Reinitializing connection...');
          // Complete reinitialization after multiple failures
          this.initializeSocketConnection();
        } else {
          // Try to reconnect if socket exists but not connected
          if (this.socket && !this.socket.connected) {
            console.log('Reconnecting existing socket...');
            this.socket.connect();
          } else if (!this.socket) {
            console.log('Socket not initialized. Creating new connection...');
            this.initializeSocketConnection();
          }
        }
      } else {
        if (!this.serverAvailable) {
          console.log('Server connection check: Connection restored');
        }
        this.serverAvailable = true;
        consecutiveFailures = 0; // Reset failure counter on successful connection
      }
    }, 5000); // Check every 5 seconds for faster recovery
  }

  private initializeSocketConnection() {
    // Use the ngrok URL for the signaling server
    const serverUrl = 'https://839b-103-88-101-242.ngrok-free.app';
    
    console.log('Initializing connection to signaling server:', serverUrl);
    
    // Close any existing socket connection before creating a new one
    if (this.socket) {
      console.log('Closing existing socket connection');
      this.socket.removeAllListeners(); // Ensure all listeners are removed
      this.socket.close();
      this.socket = null as any; // Clear the reference
    }
    
    // Enhanced connection options with fallback support
    const options = {
      transports: ['websocket', 'polling'],
      secure: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 30000,
      autoConnect: true,
      forceNew: true,
      multiplex: false,
      upgrade: true,
      rememberUpgrade: true,
      path: '/socket.io/',
      withCredentials: true,
      extraHeaders: {}
    };
    
    try {
      // Create a new socket instance with our local server through the proxy
      this.socket = io(serverUrl, options);
      
      // Setup socket event listeners
      this.setupSocketListeners();
      
      console.log('Socket.IO connection initialized');
    } catch (error) {
      console.error('Error creating socket connection:', error);
      this.connectionStateSubject.next(false);
    }
  }
  
  // Simplified connection approach - no retry needed as we're using our local server

  private setupSocketListeners() {
    // Clear any existing listeners to prevent duplicates
    this.socket.off('matched');
    this.socket.off('offer');
    this.socket.off('answer');
    this.socket.off('ice-candidate');
    this.socket.off('partner-disconnected');
    this.socket.off('connect');
    this.socket.off('connect_error');
    this.socket.off('disconnect');
    this.socket.off('reconnect');
    this.socket.off('reconnect_attempt');
    this.socket.off('reconnect_error');
    this.socket.off('reconnect_failed');
    this.socket.off('error');
    
    // Socket connection events
    this.socket.on('connect', () => {
      console.log('Connected to signaling server with ID:', this.socket.id);
      
      // Send any pending ICE candidates that were stored during connection loss
      if (this._pendingIceCandidates.length > 0 && this.peerConnection) {
        console.log(`Sending ${this._pendingIceCandidates.length} pending ICE candidates`);
        this._pendingIceCandidates.forEach(candidate => {
          this.socket.emit('ice-candidate', candidate);
        });
        this._pendingIceCandidates = [];
      }
    });
    
    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
    
    this.socket.on('disconnect', (reason) => {
      console.warn('Socket disconnected:', reason);
      this.connectionStateSubject.next(false);
      
      // If disconnected due to transport error, try to reconnect
      if (reason === 'transport error' || reason === 'transport close') {
        console.log('Transport error, attempting to reconnect...');
      }
    });
    
    // Additional reconnection event handlers
    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`Reconnection attempt ${attemptNumber}...`);
    });
    
    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`Reconnected after ${attemptNumber} attempts`);
    });
    
    this.socket.on('reconnect_error', (error) => {
      console.error('Reconnection error:', error);
    });
    
    this.socket.on('reconnect_failed', () => {
      console.error('Failed to reconnect after all attempts');
    });
    
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    // WebRTC signaling events
    this.socket.on('matched', async (data: { initiator: boolean }) => {
      console.log('Matched with partner, initiator:', data.initiator);
      if (data.initiator) {
        await this.createOffer();
      }
    });

    this.socket.on('offer', async (offer: RTCSessionDescriptionInit) => {
      if (!this.peerConnection) {
        await this.initializePeerConnection();
      }
      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);
      this.socket.emit('answer', answer);
    });

    this.socket.on('answer', async (answer: RTCSessionDescriptionInit) => {
      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(answer));
    });

    this.socket.on('ice-candidate', async (candidate: RTCIceCandidateInit) => {
      if (candidate) {
        try {
          if (!this.peerConnection) {
            console.warn('Received ICE candidate but peer connection not initialized. Initializing...');
            await this.initializePeerConnection();
          }
          
          await this.peerConnection!.addIceCandidate(new RTCIceCandidate(candidate));
          console.log('Added ICE candidate successfully');
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      }
    });

    this.socket.on('partner-disconnected', () => {
      console.log('Partner disconnected');
      this.handleDisconnection();
    });
  }

  // Set local stream from video-chat component
  setLocalStream(stream: MediaStream) {
    this.localStream = stream;
    console.log('Local stream set in WebRTC service');
  }

  // Find a random chat partner with improved connection logic
  findPartner() {
    return new Promise<boolean>((resolve, reject) => {
      try {
        // If socket doesn't exist, initialize it
        if (!this.socket) {
          console.warn('Socket not initialized. Initializing connection...');
          this.initializeSocketConnection();
          
          // Give it a moment to initialize before proceeding
          setTimeout(() => {
            this.attemptFindPartner(resolve, reject);
          }, 1000);
          return;
        }
        
        this.attemptFindPartner(resolve, reject);
      } catch (error) {
        console.error('Error in findPartner:', error);
        reject(error);
      }
    }).catch(error => {
      console.error('Error in findPartner:', error);
      // Return false to indicate failure, allowing the component to handle it
      return false;
    });
  }
  
  // Helper method to attempt finding a partner with improved error handling
  private attemptFindPartner(resolve: (value: boolean) => void, reject: (reason: any) => void) {
    if (!this.socket) {
      console.warn('Socket not initialized. Creating new connection...');
      this.initializeSocketConnection();
      
      // Give it a moment to initialize before proceeding
      setTimeout(() => {
        this.attemptConnectionAndFindPartner(resolve, reject);
      }, 1000);
      return;
    }
    
    this.attemptConnectionAndFindPartner(resolve, reject);
  }
  
  // Separate method for connection attempt and partner finding
  private attemptConnectionAndFindPartner(resolve: (value: boolean) => void, reject: (reason: any) => void) {
    if (!this.socket?.connected) {
      console.warn('Socket not connected. Reconnecting...');
      
      // Set up a timeout for the connection attempt with shorter timeout
      const connectionTimeout = setTimeout(() => {
        this.socket?.off('connect', connectHandler);
        console.error('Connection timeout. Server might be unavailable.');
        
        // Try to reinitialize the connection as a last resort
        console.log('Reinitializing socket connection...');
        this.initializeSocketConnection();
        
        // Notify the user about the connection issue
        reject(new Error('Unable to connect to the server. Please try again later.'));
      }, 8000); // Reduced timeout to 8 seconds for faster feedback
      
      // Listen for connection event
      const connectHandler = () => {
        clearTimeout(connectionTimeout);
        console.log('Connected to server. Finding partner...');
        this.socket?.emit('find-partner');
        resolve(true);
      };
      
      // Set up temporary listener
      this.socket?.once('connect', connectHandler);
      
      // Set up error handler
      const errorHandler = (error: any) => {
        clearTimeout(connectionTimeout);
        console.error('Socket connection error:', error);
        reject(new Error('Unable to connect to the server. Please try again later.'));
      };
      
      this.socket?.once('connect_error', errorHandler);
      
      // Attempt to connect
      this.socket?.connect();
    } else {
      console.log('Socket already connected. Finding a partner...');
      this.socket?.emit('find-partner');
      resolve(true);
    }
  }

  // Disconnect from current partner
  disconnectFromPartner() {
    console.log('Disconnecting from partner');
    this.socket?.emit('leave-chat');
    this.handleDisconnection();
  }

  // Handle disconnection (either initiated by us or partner)
  public handleDisconnection() {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.remoteStreamSubject.next(null);
    this.connectionStateSubject.next(false);
    this._pendingIceCandidates = [];
  }

  // Initialize connection with media and peer connection
  async initializeConnection(): Promise<void> {
    try {
      // Check if socket is connected
      if (!this.socket?.connected) {
        console.warn('Socket not connected. Reconnecting...');
        this.socket?.connect();
      }
      
      // Initialize peer connection if not already initialized
      if (!this.peerConnection) {
        await this.initializePeerConnection();
      }
    } catch (error) {
      console.error('Error initializing connection:', error);
      throw error;
    }
  }

  private async initializePeerConnection(): Promise<void> {
    try {
      // Clean up any existing connection
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }
  
      // Enhanced configuration with more STUN/TURN servers for better connectivity
      const enhancedConfiguration: RTCConfiguration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          // Add public TURN servers as fallback
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ],
        iceCandidatePoolSize: 10,  // Increase candidate pool for better connectivity
        iceTransportPolicy: 'all', // Allow both relay and direct connections
        rtcpMuxPolicy: 'require'   // Required for modern WebRTC implementations
      };
  
      // Create new peer connection with enhanced configuration
      this.peerConnection = new RTCPeerConnection(enhancedConfiguration);
      console.log('Peer connection initialized with enhanced configuration');
  
      // Setup event handlers with improved error handling
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('New ICE candidate:', event.candidate.type);
          
          // Send ICE candidate to signaling server
          if (this.socket && this.socket.connected) {
            this.socket.emit('ice-candidate', event.candidate);
          } else {
            // Store candidates if socket is not connected
            console.warn('Socket not connected. Storing ICE candidate for later.');
            this._pendingIceCandidates.push(event.candidate);
          }
        } else {
          console.log('ICE candidate gathering complete');
        }
      };
  
      this.peerConnection.onicecandidateerror = (event: any) => {
        console.warn('ICE candidate error:', event);
      };
  
      this.peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', this.peerConnection?.iceConnectionState);
        
        switch(this.peerConnection?.iceConnectionState) {
          case 'connected':
          case 'completed':
            this.connectionStateSubject.next(true);
            break;
          case 'failed':
            console.error('ICE connection failed. Attempting to restart ICE...');
            this.restartIce();
            break;
          case 'disconnected':
            console.warn('ICE connection disconnected. Waiting for reconnection...');
            // Wait briefly to see if connection recovers before notifying UI
            setTimeout(() => {
              if (this.peerConnection?.iceConnectionState === 'disconnected') {
                this.connectionStateSubject.next(false);
              }
            }, 5000);
            break;
          case 'closed':
            this.connectionStateSubject.next(false);
            break;
        }
      };
  
      this.peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', this.peerConnection?.connectionState);
        
        switch(this.peerConnection?.connectionState) {
          case 'connected':
            console.log('WebRTC connection established successfully');
            break;
          case 'disconnected':
            console.warn('WebRTC connection disconnected');
            break;
          case 'failed':
            console.error('WebRTC connection failed. Resetting connection.');
            this.handleDisconnection();
            break;
          case 'closed':
            console.log('WebRTC connection closed');
            this.connectionStateSubject?.next(false);
            break;
        }
      };
  
      this.peerConnection.onnegotiationneeded = async () => {
        console.log('Negotiation needed');
        try {
          if (this.socket && this.socket.connected) {
            await this.createOffer();
          }
        } catch (error) {
          console.error('Error during negotiation:', error);
        }
      };
  
      this.peerConnection.ontrack = (event: RTCTrackEvent) => {
        console.log('Remote track received:', event.track.kind);
        if (event.streams && event.streams[0]) {
          console.log('Setting remote stream');
          this.remoteStreamSubject?.next(event.streams[0]);
        }
      };
  
      // Add local tracks
      if (this.localStream) {
        console.log('Adding local tracks to peer connection');
        this.localStream.getTracks().forEach(track => {
          try {
            if (this.peerConnection && this.localStream) {
              this.peerConnection.addTrack(track, this.localStream);
            }
          } catch (error) {
            console.error('Error adding track to peer connection:', error);
          }
        });
      } else {
        console.warn('No local stream available to add tracks');
      }
    } catch (error) {
      console.error('Error initializing peer connection:', error);
      throw error;
    }
  }
  
  // Method to restart ICE when connection fails
  private async restartIce() {
    if (!this.peerConnection) return;
    
    try {
      if (this.peerConnection.restartIce) {
        console.log('Restarting ICE connection...');
        this.peerConnection.restartIce();
      } else {
        // Fallback for browsers that don't support restartIce()
        console.log('Browser does not support restartIce(). Creating new offer with ICE restart...');
        const offer = await this.peerConnection.createOffer({ iceRestart: true });
        await this.peerConnection.setLocalDescription(offer);
        this.socket?.emit('offer', offer);
      }
    } catch (error) {
      console.error('Error restarting ICE:', error);
    }
  }

  // Create offer and send it to the signaling server
  async createOffer(): Promise<void> {
    try {
      if (!this.peerConnection) {
        await this.initializePeerConnection();
      }

      if (!this.peerConnection) {
        throw new Error('Failed to initialize peer connection');
      }

      console.log('Creating offer...');
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await this.peerConnection.setLocalDescription(offer);
      console.log('Local description set, sending offer to signaling server');
      
      // Send the offer to the signaling server
      this.socket?.emit('offer', offer);
    } catch (error) {
      console.error('Error creating offer:', error);
      throw error;
    }
  }

  // Clean up resources
  disconnect(): void {
    console.log('Disconnecting WebRTC service');
    
    // Stop server availability check
    if (this.serverCheckInterval) {
      clearInterval(this.serverCheckInterval);
      this.serverCheckInterval = null;
    }
    
    // Disconnect from signaling server
    if (this.socket) {
      // Remove all listeners before disconnecting
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }
    
    // Close peer connection
    if (this.peerConnection) {
      // Remove all event listeners
      if (this.peerConnection.onicecandidate) this.peerConnection.onicecandidate = null;
      if (this.peerConnection.oniceconnectionstatechange) this.peerConnection.oniceconnectionstatechange = null;
      if (this.peerConnection.onconnectionstatechange) this.peerConnection.onconnectionstatechange = null;
      if (this.peerConnection.ontrack) this.peerConnection.ontrack = null;
      if (this.peerConnection.onnegotiationneeded) this.peerConnection.onnegotiationneeded = null;
      
      // Close the connection
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    // Stop local media tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
      });
      this.localStream = null;
    }
    
    // Reset state
    this.remoteStreamSubject?.next(null);
    this.connectionStateSubject?.next(false);
    this._pendingIceCandidates = [];
    this.serverAvailable = true;
  }

  // Get local stream
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }
}