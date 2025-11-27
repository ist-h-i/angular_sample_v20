import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  NgZone,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { PrimaryButton } from '../../../../../shared/ui/primary-button/primary-button';
import { Chat } from '../../ui/chat/chat';
import type { Message } from '../../../../../shared/core/models/message.model';
import {
  SelectedRequestStore,
  ThinkingProcessState,
} from '../../../../../shared/core/stores/selected-request.store';
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
  constructor(private readonly ngZone: NgZone) {
    // Sync messages when selected request detail changes
    effect(() => {
      const detail = this.selectedStore.detail();
      const nextMessages = detail?.messages ?? [];
      const apply = () => this.messages.set(nextMessages);
      if (typeof queueMicrotask === 'function') {
        queueMicrotask(apply);
      } else {
        Promise.resolve().then(apply);
      }
    });
  }

  public readonly messages = signal<Message[]>([]);
  public draft = '';
  public inputValue = '';

  // Header bindings
  readonly currentTitle = computed(() => this.selectedStore.detail()?.title ?? 'リクエストを選択してください');
  readonly currentStatus = computed(() => this.selectedStore.detail()?.status ?? '-');
  readonly finalThinkingProcess = computed<ThinkingProcessState | null>(() => {
    const process = this.selectedStore.thinkingProcess();
    if (!process || process.isStreaming) return null;
    if (!process.raw?.trim() && !(process.phases?.length ?? 0)) {
      return null;
    }
    return process;
  });

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
    this.messages.update((existing) => [...existing, newMsg]);

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
