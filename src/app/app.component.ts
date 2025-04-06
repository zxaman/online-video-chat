import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VideoChatComponent } from './video-chat/video-chat.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, VideoChatComponent],
  template: `
    <div class="app-container">
      <header class="app-header">
        <h1>Random Video Chat</h1>
      </header>
      <main>
        <app-video-chat></app-video-chat>
      </main>
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
      background: #f5f5f5;
    }

    .app-header {
      background: #2c3e50;
      color: white;
      padding: 1rem;
      text-align: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);

      h1 {
        margin: 0;
        font-size: 1.8rem;
      }
    }

    main {
      padding: 1rem;
    }
  `]
})
export class AppComponent {}
