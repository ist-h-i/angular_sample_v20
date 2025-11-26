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
  @Output() copyRequested = new EventEmitter<Message>();
  @Output() resendRequested = new EventEmitter<Message>();

  onCopy(message: Message): void {
    this.copyRequested.emit(message);
  }

  onResend(message: Message): void {
    this.resendRequested.emit(message);
  }
}
