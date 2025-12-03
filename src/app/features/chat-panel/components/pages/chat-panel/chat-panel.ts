import { Component, ElementRef, ViewChild, AfterViewInit, NgZone, computed, effect, HostListener, inject } from '@angular/core';
import { Chat } from '../../ui/chat/chat';
import type { Message } from '../../../../../shared/core/models/message.model';
import { SelectedRequestStore } from '../../../../../shared/core/stores/selected-request.store';
import { RequestFacade } from '../../../../request-queue/components/pages/request-queue/request.facade';

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  imports: [Chat],
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
  public selectedModel = 'gpt-4';
  public modelDropdownOpen = false;
  readonly modelOptions = [
    { label: 'GPT-4', value: 'gpt-4' },
    { label: 'GPT-3.5', value: 'gpt-3.5' },
    { label: 'Gemini', value: 'gemini' },
  ];

  // Header bindings
  readonly currentTitle = computed(() => this.selectedStore.detail()?.title ?? 'リクエストを選択してください');
  readonly currentStatus = computed(() => this.selectedStore.detail()?.status ?? '-');

  @ViewChild('userInput', { read: ElementRef, static: true })
  userInputRef!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('modelShell', { read: ElementRef, static: true })
  modelShellRef!: ElementRef<HTMLDivElement>;

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

  toggleModelDropdown(): void {
    this.modelDropdownOpen = !this.modelDropdownOpen;
  }

  selectModel(value: string): void {
    this.selectedModel = value;
    this.modelDropdownOpen = false;
  }

  onModelTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.modelDropdownOpen = true;
      return;
    }
    if (event.key === 'Escape') {
      this.modelDropdownOpen = false;
    }
  }

  onModelOptionKeydown(event: KeyboardEvent, value: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selectModel(value);
    }
  }

  get selectedModelLabel(): string {
    return this.modelOptions.find((option) => option.value === this.selectedModel)?.label ?? this.selectedModel;
  }

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: MouseEvent): void {
    if (!this.modelDropdownOpen) return;
    if (this.modelShellRef?.nativeElement.contains(event.target as Node)) return;
    this.modelDropdownOpen = false;
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
    this.messages = [...this.messages, newMsg];

    const historyId = this.selectedStore.selectedId() ?? null;
    void this.requestFacade.submitRequest(message, historyId).catch((error) => {
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
