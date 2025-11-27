import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { Message } from '../../../../../shared/core/models/message.model';

type MessageSegment =
  | { type: 'text'; content: string }
  | { type: 'link'; content: string; url: string; index: number };

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

  getSegments(message: Message): MessageSegment[] {
    const content = message.content ?? '';
    const annotations = message.annotations ?? [];

    if (!annotations.length) {
      return [{ type: 'text', content }];
    }

    const urlNumberMap = new Map<string, number>();
    annotations.forEach((annotation, idx) => {
      if (annotation?.url && !urlNumberMap.has(annotation.url)) {
        urlNumberMap.set(annotation.url, idx + 1);
      }
    });

    const urlRegex = /https?:\/\/[^\s]+/g;
    const segments: MessageSegment[] = [];
    let lastIndex = 0;

    for (const match of content.matchAll(urlRegex)) {
      const url = match[0];
      const startIndex = match.index ?? 0;
      const number = urlNumberMap.get(url);

      if (number == null) {
        continue;
      }

      if (startIndex > lastIndex) {
        segments.push({ type: 'text', content: content.slice(lastIndex, startIndex) });
      }

      segments.push({ type: 'link', content: url, url, index: number });
      lastIndex = startIndex + url.length;
    }

    if (lastIndex < content.length) {
      segments.push({ type: 'text', content: content.slice(lastIndex) });
    }

    return segments.length ? segments : [{ type: 'text', content }];
  }
}
