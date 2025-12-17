import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import type { Message } from '../../../../../shared/core/models/message.model';
import type { ThinkingProcessState } from '../../../../../shared/core/stores/selected-request.store';

@Component({
  selector: 'app-chat',
  imports: [],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class Chat implements OnChanges {
  @Input() messages: Message[] = [];
  @Input() finalThinkingProcess: ThinkingProcessState | null = null;
  @Input() acceptedMessageKey: string | null = null;
  @Input() acceptedMessageActive = false;
  @Input() sendingMessageKey: string | null = null;
  @Input() sendingMessageActive = false;
  @Input() failedMessageKey: string | null = null;
  @Input() failedMessageActive = false;
  groupedMessages: { items: Message[]; anchor: Message; anchorIndex: number }[] = [];
  private finalProcessExpanded = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['messages']) {
      this.groupedMessages = this.buildGroupedMessages();
    }
    if (changes['finalThinkingProcess']) {
      this.finalProcessExpanded = false;
    }
  }

  shouldShowProcessFor(index: number, role: Message['role']): boolean {
    if (role !== 'assistant') return false;
    const process = this.finalThinkingProcess;
    if (!process || process.isStreaming) return false;
    return index === this.findLastAssistantIndex();
  }

  isAcceptedMessage(message: Message | null | undefined): boolean {
    if (!message) return false;
    if (message.role !== 'user') return false;
    if (!this.acceptedMessageActive) return false;
    return Boolean(this.acceptedMessageKey && this.acceptedMessageKey === message.timestamp);
  }

  isFailedMessage(message: Message | null | undefined): boolean {
    if (!message) return false;
    if (message.role !== 'user') return false;
    if (!this.failedMessageActive) return false;
    return Boolean(this.failedMessageKey && this.failedMessageKey === message.timestamp);
  }

  isSendingMessage(message: Message | null | undefined): boolean {
    if (!message) return false;
    if (message.role !== 'user') return false;
    if (!this.sendingMessageActive) return false;
    return Boolean(this.sendingMessageKey && this.sendingMessageKey === message.timestamp);
  }

  hasFinalProcessPhases(): boolean {
    return Boolean(this.finalThinkingProcess?.phases && this.finalThinkingProcess.phases.length > 0);
  }

  toggleFinalProcess(): void {
    this.finalProcessExpanded = !this.finalProcessExpanded;
  }

  isFinalProcessExpanded(): boolean {
    return this.finalProcessExpanded;
  }

  finalProcessToggleIcon(): string {
    return this.isFinalProcessExpanded() ? '▲' : '▼';
  }

  private findLastAssistantIndex(): number {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i]?.role === 'assistant') {
        return i;
      }
    }
    return -1;
  }

  private buildGroupedMessages(): { items: Message[]; anchor: Message; anchorIndex: number }[] {
    const groups: { items: Message[]; anchor: Message; anchorIndex: number }[] = [];
    let pending: Message[] = [];

    this.messages.forEach((message, index) => {
      if (!message) return;
      if (this.isChatMessage(message.role)) {
        const items = [...pending, message];
        groups.push({ items, anchor: message, anchorIndex: index });
        pending = [];
      } else {
        pending = [...pending, message];
      }
    });

    return groups;
  }

  private isChatMessage(role: Message['role']): boolean {
    return role === 'assistant' || role === 'user';
  }
}
