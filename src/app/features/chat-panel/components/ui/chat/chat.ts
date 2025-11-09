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
}
