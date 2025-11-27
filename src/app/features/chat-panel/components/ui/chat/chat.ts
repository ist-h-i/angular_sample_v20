import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { Message } from '../../../../../shared/core/models/message.model';

@Component({
  selector: 'app-chat',
  imports: [],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class Chat {
  @Input() messages: Message[] = [];
  @Input() selectedMessageIndex: number | null = null;

  @Output() selectMessage = new EventEmitter<number | null>();

  onMessageSelect(index: number, role: Message['role']): void {
    if (role === 'user') {
      this.selectMessage.emit(null);
      return;
    }

    this.selectMessage.emit(index);
  }

  clearSelection(): void {
    this.selectMessage.emit(null);
  }
}
