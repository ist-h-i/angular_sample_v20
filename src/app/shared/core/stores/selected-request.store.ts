import { Injectable, computed, effect, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Annotation } from '../models/annotation.model';
import type { Message } from '../models/message.model';
import type { RequestDetail } from '../models/request.model';
import { ApiService } from '../services/api.service';

interface ResultStreamState {
  source: EventSource;
  messageIndex: number;
  accumulated: string;
  messageHandler: (event: MessageEvent) => void;
  errorHandler: (event: Event) => void;
}

@Injectable({ providedIn: 'root' })
export class SelectedRequestStore {
  private readonly _selectedId = signal<string | null>(null);
  private readonly _detail = signal<RequestDetail | null>(null);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _error = signal<unknown | null>(null);
  private readonly _selectedMessageIndex = signal<number | null>(null);

  readonly selectedId = this._selectedId.asReadonly();
  readonly detail = this._detail.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly selectedMessageIndex = this._selectedMessageIndex.asReadonly();

  // Convenience derived values
  readonly hasDetail = computed(() => this._detail() != null);

  private readonly resultStreams = new Map<string, ResultStreamState>();

  constructor(private readonly api: ApiService) {
    let previousStreamedId: string | null = null;
    effect(() => {
      const currentId = this._selectedId();
      if (previousStreamedId && previousStreamedId !== currentId) {
        this.stopResultStream(previousStreamedId, false);
      }
      previousStreamedId = currentId;
    });

    effect(() => {
      // Clear message selection when the active request changes
      this._selectedId();
      this._selectedMessageIndex.set(null);
    });
  }

  async select(id: string): Promise<void> {
    if (!id) return;
    this._selectedId.set(id);
    await this.loadDetail(id);
  }

  async reload(): Promise<void> {
    const id = this._selectedId();
    if (!id) return;
    await this.loadDetail(id);
  }

  startResultStream(id: string): void {
    if (!id || typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    if (this.resultStreams.has(id)) return;

    const url = `/requests/${encodeURIComponent(id)}/result`;
    const source = new EventSource(url);
    const messageHandler = (event: MessageEvent) => this.handleSseMessage(id, event);
    const errorHandler = () => this.handleSseError(id, source);

    source.addEventListener('message', messageHandler);
    source.addEventListener('error', errorHandler);

    this.resultStreams.set(id, {
      source,
      messageIndex: -1,
      accumulated: '',
      messageHandler,
      errorHandler,
    });
  }

  stopResultStream(id: string, reloadDetail = true): void {
    const state = this.resultStreams.get(id);
    if (!state) return;
    state.source.removeEventListener('message', state.messageHandler);
    state.source.removeEventListener('error', state.errorHandler);
    state.source.close();
    this.resultStreams.delete(id);
    if (reloadDetail) {
      void this.loadDetail(id);
    }
  }

  clearSelection(): void {
    const currentId = this._selectedId();
    if (currentId) {
      this.stopResultStream(currentId, false);
    }
    this._selectedId.set(null);
    this._detail.set(null);
    this._error.set(null);
    this._isLoading.set(false);
    this._selectedMessageIndex.set(null);
  }

  setSelectedMessageIndex(index: number | null): void {
    this._selectedMessageIndex.set(index);
  }

  private async loadDetail(id: string): Promise<void> {
    if (!id) return;
    this._isLoading.set(true);
    this._error.set(null);
    try {
      const detail = await firstValueFrom(this.api.getRequestById(id));
      this._detail.set(detail ?? null);
    } catch (err) {
      this._error.set(err);
      this._detail.set(null);
    } finally {
      this._isLoading.set(false);
    }
  }

  private handleSseMessage(id: string, event: MessageEvent): void {
    const raw = typeof event.data === 'string' ? event.data : String(event.data ?? '');
    const trimmed = raw?.trim();
    if (!trimmed) return;
    if (trimmed === '[DONE]') {
      this.stopResultStream(id);
      return;
    }
    const payload = this.parseSsePayload(trimmed);
    const chunk = this.extractChunk(payload);
    if (!chunk) return;
    const annotations = this.extractAnnotations(payload);
    this.appendStreamChunk(id, chunk, annotations);
  }

  private handleSseError(id: string, source: EventSource): void {
    if (typeof EventSource !== 'undefined' && source.readyState === EventSource.CLOSED) {
      this.stopResultStream(id);
    }
  }

  private appendStreamChunk(id: string, chunk: string, annotations?: Annotation[]): void {
    const state = this.resultStreams.get(id);
    if (!state || !chunk) return;
    const detail = this._detail();
    if (!detail || detail.request_id !== id) return;
    const messages = detail.messages ?? [];
    let updated = [...messages];
    if (state.messageIndex < 0 || state.messageIndex >= updated.length) {
      const assistantMessage: Message = {
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
      };
      updated = [...updated, assistantMessage];
      state.messageIndex = updated.length - 1;
    }
    state.accumulated += chunk;
    const existing = updated[state.messageIndex];
    updated[state.messageIndex] = {
      ...existing,
      content: state.accumulated,
      annotations: annotations ?? existing?.annotations,
      timestamp: existing?.timestamp ?? new Date().toISOString(),
    };
    this._detail.set({ ...detail, messages: updated });
  }

  private parseSsePayload(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  private extractChunk(payload: unknown): string {
    if (!payload) return '';
    if (typeof payload === 'string') return payload;
    if (typeof payload !== 'object') return '';
    const asRecord = payload as Record<string, unknown>;
    const prefer = (value: unknown): string | undefined => {
      if (typeof value === 'string' && value.trim()) return value;
      if (typeof value === 'object' && value != null) {
        const nested = value as Record<string, unknown>;
        const contentValue = nested['content'];
        if (typeof contentValue === 'string' && contentValue.trim()) return contentValue;
        const textValue = nested['text'];
        if (typeof textValue === 'string' && textValue.trim()) return textValue;
      }
      return undefined;
    };
    return (
      prefer(asRecord['delta']) ??
      prefer(asRecord['content']) ??
      prefer(asRecord['text']) ??
      ''
    );
  }

  private extractAnnotations(payload: unknown): Annotation[] | undefined {
    if (!payload || typeof payload !== 'object') return undefined;
    const asRecord = payload as Record<string, unknown>;
    const direct = asRecord['annotations'];
    if (Array.isArray(direct)) {
      return direct as Annotation[];
    }
    const delta = asRecord['delta'];
    if (delta && typeof delta === 'object') {
      const nested = (delta as Record<string, unknown>)['annotations'];
      if (Array.isArray(nested)) {
        return nested as Annotation[];
      }
    }
    return undefined;
  }
}
