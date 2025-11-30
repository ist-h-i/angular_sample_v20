import { Component, ElementRef, ViewChild, AfterViewInit, NgZone, computed, effect, inject } from '@angular/core';
import { PrimaryButton } from '../../../../../shared/ui/primary-button/primary-button';
import { Chat } from '../../ui/chat/chat';
import type { Message } from '../../../../../shared/core/models/message.model';
import { SelectedRequestStore } from '../../../../../shared/core/stores/selected-request.store';
import { RequestFacade } from '../../../../request-queue/components/pages/request-queue/request.facade';
import type { RequestStatus } from '../../../../../shared/core/models/request-status.model';
import type { RequestSummary } from '../../../../../shared/core/models/request-summary.model';

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  imports: [PrimaryButton, Chat],
  templateUrl: './chat-panel.html',
  styleUrl: './chat-panel.scss',
})
export class ChatPanel implements AfterViewInit {
  private readonly selectedStore = inject(SelectedRequestStore);
  private readonly requestFacade = inject(RequestFacade);
  constructor(private readonly ngZone: NgZone) {
    // Sync messages when selected request detail changes
    effect(() => {
      const detail = this.selectedStore.detail();
      this.messages = detail?.messages ?? [];
    });
  }

  public messages: Message[] = [];
  public draft = '';
  public inputValue = '';

  // Header bindings
  readonly currentTitle = computed(() => this.selectedStore.detail()?.title ?? 'リクエストを選択してください');
  readonly currentStatus = computed(() => this.selectedStore.detail()?.status ?? '-');

  // Pending/initialized guard: queue level & current detail level
  private readonly pendingLikeCount = computed(() => {
    const snapshot = this.requestFacade.requests ? this.requestFacade.requests() : {};
    const values = Object.values(snapshot ?? {}) as RequestSummary[];
    return values.filter((r) => this.isPendingLike(r?.status)).length;
  });

  readonly isQueueThresholdReached = computed(() => this.pendingLikeCount() >= 3);
  readonly isCurrentRequestPendingLike = computed(() =>
    this.isPendingLike(this.selectedStore.detail()?.status),
  );

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

  get sendDisabled(): boolean {
    if (!this.inputValue || !this.inputValue.trim()) return true;
    if (this.isQueueThresholdReached()) return true;
    if (this.isCurrentRequestPendingLike()) return true;
    return false;
  }

  get helperMessage(): string {
    if (this.isQueueThresholdReached()) {
      return 'ペンディングまたはイニシャライズドのリクエストが3件以上のため、新規送信できません。';
    }
    if (this.isCurrentRequestPendingLike()) {
      return '処理中です。お待ち下さい。';
    }
    return '';
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
    void this.requestFacade.submitRequest(message, historyId).catch((error) => {
      console.error('Failed to send message request', error);
    });
  }

  onCopyMessage(message: Message): void {
    if (!message?.content) return;

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(message.content).catch((error) => {
        console.error('Failed to copy message', error);
      });
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = message.content;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }

  onResendMessage(message: Message): void {
    const text = message?.content?.trim();
    if (!text) return;

    this.sendMessage(text);

    if (this.userInputRef?.nativeElement) {
      this.userInputRef.nativeElement.focus();
    }
  }

  private isPendingLike(status: RequestStatus | string | null | undefined): boolean {
    if (typeof status !== 'string') return false;
    const normalized = status.toLowerCase();
    return normalized === 'pending' || normalized === 'initialized';
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
