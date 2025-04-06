import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { WebRTCService } from '../services/webrtc.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-video-chat',
  templateUrl: './video-chat.component.html',
  styleUrls: ['./video-chat.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class VideoChatComponent implements OnInit, OnDestroy {
  @ViewChild('localVideo') localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideo!: ElementRef<HTMLVideoElement>;
  
  isConnected = false;
  isFindingPartner = false;
  isCameraEnabled = true;
  isAudioEnabled = true;
  localStream: MediaStream | null = null;

  constructor(private webRTCService: WebRTCService) {}

  ngOnDestroy() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
      });
      this.localStream = null;
    }
    if (this.localVideo?.nativeElement) {
      this.localVideo.nativeElement.srcObject = null;
    }
    if (this.remoteVideo?.nativeElement) {
      this.remoteVideo.nativeElement.srcObject = null;
    }
  }

  hasMediaPermissions = false;
  mediaError: string | null = null;

  async ngOnInit() {
    try {
      await this.checkMediaPermissions();
      if (this.hasMediaPermissions) {
        await this.startLocalStream();
        if (this.localStream) {
          this.webRTCService.initializeConnection();
          
          this.webRTCService.remoteStream$.subscribe(stream => {
            if (stream && this.remoteVideo?.nativeElement) {
              this.remoteVideo.nativeElement.srcObject = stream;
              this.isConnected = true;
            }
          });

          this.webRTCService.connectionState$.subscribe(connected => {
            this.isConnected = connected;
            if (!connected && this.remoteVideo?.nativeElement) {
              this.remoteVideo.nativeElement.srcObject = null;
            }
          });
        } else {
          this.mediaError = "Failed to initialize media stream. Please check your camera and microphone settings.";
        }
      }
    } catch (error: any) {
      console.error('Error in ngOnInit:', error);
      this.handleMediaError(error);
    }
  }

  async checkMediaPermissions() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Your browser does not support media devices API. Please use a modern browser.');
      }

      // Single media request with fallback constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      }).catch(async (error) => {
        // Fallback to basic constraints if ideal resolution fails
        if (error.name === 'OverconstrainedError') {
          return navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        }
        throw error;
      });

      this.hasMediaPermissions = true;
      this.mediaError = null;
      return stream;
    } catch (error: any) {
      this.hasMediaPermissions = false;
      this.handleMediaError(error);
      return null;
    }
  }

  private handleMediaError(error: any) {
    if (error.name === 'NotAllowedError') {
      this.mediaError = 'Permission denied. Please enable camera/mic access in browser settings.';
    } else if (error.name === 'NotFoundError') {
      this.mediaError = 'No media devices found. Please connect a camera and microphone.';
    } else if (error.name === 'NotReadableError') {
      this.mediaError = 'Device is already in use by another application.';
    } else if (error.name === 'OverconstrainedError') {
      this.mediaError = 'Requested device configuration not supported. Using fallback settings.';
    } else {
      this.mediaError = `Media error: ${error.message || 'Unknown error'}`;
    }
    console.error('Media error:', error);
  }

  async startLocalStream(): Promise<MediaStream | null> {
    try {
      const stream = await this.checkMediaPermissions();
      if (stream) {
        this.localStream = stream;
        if (this.localVideo?.nativeElement) {
          const videoElement = this.localVideo.nativeElement;
          videoElement.srcObject = stream;
          videoElement.onloadedmetadata = () => {
            videoElement.play().catch(error => {
              console.error('Error playing local video:', error);
              this.handleMediaError(error);
            });
          };
          videoElement.onerror = (error) => {
            console.error('Video element error:', error);
            this.handleMediaError(new Error('Failed to display video stream'));
          };
          this.webRTCService.setLocalStream(stream);
          this.isCameraEnabled = true;
          this.isAudioEnabled = true;
          return stream;
        } else {
          throw new Error('Local video element not initialized');
        }
      } else {
        throw new Error('Failed to get media stream');
      }
    } catch (error: any) {
      console.error('Error in startLocalStream:', error);
      this.handleMediaError(error);
      return null;
    }
  }

  toggleCamera() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        this.isCameraEnabled = !this.isCameraEnabled;
        videoTrack.enabled = this.isCameraEnabled;
      }
    }
  }

  toggleAudio() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        this.isAudioEnabled = !this.isAudioEnabled;
        audioTrack.enabled = this.isAudioEnabled;
      }
    }
  }

  async findPartner() {
    this.isFindingPartner = true;
    this.mediaError = null; // Clear any previous errors
    
    try {
      const success = await this.webRTCService.findPartner();
      if (!success) {
        this.mediaError = 'Unable to connect to the server. Please try again later.';
        this.isFindingPartner = false;
      }
    } catch (error: any) {
      console.error('Error finding partner:', error);
      this.mediaError = `Connection error: ${error.message || 'Server unavailable'}`;
      this.isFindingPartner = false;
    }
  }

  skipPartner() {
    this.webRTCService.disconnectFromPartner();
    this.findPartner();
  }

  endChat() {
    this.webRTCService.disconnectFromPartner();
    this.isFindingPartner = false;
  }
}