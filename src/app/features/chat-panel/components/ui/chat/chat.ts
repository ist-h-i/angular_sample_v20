import { Component, Input } from '@angular/core';
import type { Message } from '../../../../../shared/core/models/message.model';

@Component({
  selector: 'app-chat',
  imports: [],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class Chat {
  @Input() messages: Message[] = [];

  selectedMessageIndex: number | null = null;

  onMessageSelect(index: number, role: Message['role']): void {
    if (role === 'user') {
      this.selectedMessageIndex = null;
      return;
    }

    this.selectedMessageIndex = index;
  }

  clearSelection(): void {
    this.selectedMessageIndex = null;
  }
}
