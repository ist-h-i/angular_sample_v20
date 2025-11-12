import { Component, ElementRef, ViewChild, AfterViewInit, NgZone, computed, effect, inject } from '@angular/core';
import { PrimaryButton } from '../../../../../shared/ui/primary-button/primary-button';
import { Chat } from '../../ui/chat/chat';
import type { Message } from '../../../../../shared/core/models/message.model';
import { SelectedRequestStore } from '../../../../../shared/core/stores/selected-request.store';
import { RequestFacade } from '../../../../request-queue/components/pages/request-queue/request.facade';
import { AiModelSelectionStore } from '../../../../../shared/core/stores/ai-model-selection.store';

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  imports: [PrimaryButton, Chat],
  templateUrl: './chat-panel.html',
  styleUrl: './chat-panel.scss',
})
export class ChatPanel implements AfterViewInit {
  public readonly selectedStore = inject(SelectedRequestStore);
  private readonly requestFacade = inject(RequestFacade);
  private readonly aiModelSelectionStore = inject(AiModelSelectionStore);
  public manualThinkingPanelOpen = false;
  constructor(private readonly ngZone: NgZone) {
    // Sync messages when selected request detail changes
    effect(() => {
      const detail = this.selectedStore.detail();
      this.messages = detail?.messages ?? [];
    });
    effect(() => {
      const thinking = this.selectedStore.thinkingProcess();
      if (!thinking || thinking.isStreaming) {
        this.manualThinkingPanelOpen = false;
      }
    });
  }

  public messages: Message[] = [];
  public draft = '';
  public inputValue = '';

  // Header bindings
  readonly currentTitle = computed(() => this.selectedStore.detail()?.title ?? 'リクエストを選択してください');
  readonly currentStatus = computed(() => this.selectedStore.detail()?.status ?? '-');

  @ViewChild('userInput', { read: ElementRef, static: true })
  userInputRef!: ElementRef<HTMLTextAreaElement>;

  ngAfterViewInit(): void {
    // Initial resize after view init
    this.ngZone.runOutsideAngular(() => setTimeout(() => this.resizeTextarea(), 0));
  }

  onInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.inputValue = target.value;
    this.draft = this.inputValue;
    this.resizeTextarea();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.trySend();
      return;
    }
    if (event.key === 'Enter' && event.shiftKey) {
      setTimeout(() => this.resizeTextarea(), 0);
    }
  }

  onSendClick(): void {
    this.trySend();
  }

  public send(): void {
    this.trySend();
  }

  public toggleThinkingPanel(): void {
    this.manualThinkingPanelOpen = !this.manualThinkingPanelOpen;
  }

  public shouldShowThinkingPanel(): boolean {
    const thinking = this.selectedStore.thinkingProcess();
    return Boolean(thinking?.raw && (thinking.isStreaming || this.manualThinkingPanelOpen));
  }

  public isStreamingThinking(): boolean {
    return Boolean(this.selectedStore.thinkingProcess()?.isStreaming);
  }

  public shouldLimitThinkingPanelHeight(): boolean {
    const thinking = this.selectedStore.thinkingProcess();
    return Boolean(thinking?.isStreaming && !this.manualThinkingPanelOpen);
  }

  public thinkingToggleIcon(): string {
    return this.manualThinkingPanelOpen ? '▲' : '▼';
  }

  public thinkingPhases(): Array<{ title: string; steps: string[] }> {
    return this.selectedStore.thinkingProcess()?.phases ?? [];
  }

  public hasThinkingPhases(): boolean {
    return this.thinkingPhases().length > 0;
  }

  public thinkingRaw(): string {
    return this.selectedStore.thinkingProcess()?.raw ?? '';
  }

  private trySend(): void {
    const text = (this.userInputRef?.nativeElement?.value || '').trim();
    if (!text) return;
    this.sendMessage(text);

    if (this.userInputRef?.nativeElement) {
      this.userInputRef.nativeElement.value = '';
      this.inputValue = '';
      this.draft = '';
      this.resizeTextarea();
      this.userInputRef.nativeElement.focus();
    }
  }

  private sendMessage(message: string): void {
    const newMsg: Message = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    this.messages = [...this.messages, newMsg];

    const historyId = this.selectedStore.selectedId() ?? null;
    const aiModelId = this.aiModelSelectionStore.selectedModelId();
    void this.requestFacade.submitRequest(message, historyId, aiModelId).catch((error) => {
      console.error('Failed to send message request', error);
    });
  }

  private resizeTextarea(): void {
    const el = this.userInputRef.nativeElement;
    if (!el) return;

    this.ngZone.runOutsideAngular(() => {
      const raf =
        typeof window !== 'undefined' && window.requestAnimationFrame
          ? window.requestAnimationFrame.bind(window)
          : (cb: FrameRequestCallback) => setTimeout(cb, 0);

      raf(() => {
        el.style.overflowY = 'hidden';
        el.style.height = 'auto';
        const maxHeight = 500;
        const buffer = 4;
        const scroll = el.scrollHeight || 0;
        const newHeight = Math.min(scroll + buffer, maxHeight);
        el.style.height = `${newHeight}px`;
        el.style.overflowY = scroll + buffer > maxHeight ? 'auto' : 'hidden';
      });
    });
  }
}
