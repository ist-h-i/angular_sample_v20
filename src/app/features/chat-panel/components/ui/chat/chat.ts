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
  private finalProcessExpanded = false;

  ngOnChanges(changes: SimpleChanges): void {
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
}
