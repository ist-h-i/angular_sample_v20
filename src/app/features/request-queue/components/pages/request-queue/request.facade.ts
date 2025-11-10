import { Injectable, computed, signal, effect, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { RequestSummary } from '../../../../../shared/core/models/request-summary.model';
import type { RequestStatus } from '../../../../../shared/core/models/request-status.model';
import type {
  RequestStatusResponse,
  CreateRequestResponse,
} from '../../../../../shared/core/services/api.service';
import { ApiService } from '../../../../../shared/core/services/api.service';
import { InitialDataStore } from '../../../../../shared/core/stores/initial-data.store';
import { SelectedRequestStore } from '../../../../../shared/core/stores/selected-request.store';
import { REQUEST_POLLING_CONFIG } from './request-polling.config';

type TimerId = ReturnType<typeof setTimeout>;
type MonitorMode = 'background' | 'chat';

interface MonitorEntry {
  unsubscribe: () => void;
  pollingId: TimerId | null;
  lastInterval: number;
  consecutiveErrors: number;
  mode: MonitorMode;
}

@Injectable({ providedIn: 'root' })
export class RequestFacade {
  private readonly _requests = signal<Record<string, RequestSummary>>({});
  private readonly _monitors = new Map<string, MonitorEntry>();

  readonly requests = computed(() => this._requests());

  private readonly initialDataStore = inject(InitialDataStore);
  private readonly selectedStore = inject(SelectedRequestStore);
  private readonly setTimer = (callback: () => void, delay: number): TimerId => {
    const timerFn = typeof window !== 'undefined' ? window.setTimeout : setTimeout;
    return timerFn(callback, delay);
  };
  private readonly clearTimer = (id: TimerId | null): void => {
    if (id == null) return;
    const clearFn = typeof window !== 'undefined' ? window.clearTimeout : clearTimeout;
    clearFn(id);
  };

  constructor(private readonly api: ApiService) {
    effect(() => {
      const data = this.initialDataStore.initialData();
      if (!data) return;
      const cur = { ...(this._requests() || {}) };
      let changed = false;
      for (const h of data.request_histories ?? []) {
        if (!cur[h.request_history_id]) {
          cur[h.request_history_id] = {
            request_id: h.request_history_id,
            title: h.title,
            snippet: '',
            status: h.status,
            last_updated: h.last_updated,
          };
          changed = true;
        }
      }
      if (changed) this._requests.set(cur);
    });

    let previousDisplayedId: string | null = null;
    effect(() => {
      const currentDisplayedId = this.selectedStore.selectedId();

      if (previousDisplayedId && previousDisplayedId !== currentDisplayedId) {
        this.stopAutoMonitor(previousDisplayedId);
        this.startAutoMonitor(previousDisplayedId);
        this.resetMonitorForRequest(previousDisplayedId);
      }

      if (currentDisplayedId && currentDisplayedId !== previousDisplayedId) {
        this.stopAutoMonitor(currentDisplayedId);
        this.startChatMonitor(currentDisplayedId);
      }

      previousDisplayedId = currentDisplayedId;
    });
  }

  async refreshStatuses(): Promise<void> {
    const summaries = await firstValueFrom(this.api.getRequestsStatus());
    const next: Record<string, RequestSummary> = {};
    for (const r of summaries ?? []) {
      next[r.request_id] = r;
    }
    this._requests.set(next);
  }

  async refreshAll(): Promise<void> {
    const summaries = await firstValueFrom(this.api.getRequests());
    const next: Record<string, RequestSummary> = {};
    for (const r of summaries ?? []) {
      next[r.request_id] = r;
    }
    this._requests.set(next);
  }

  async submitRequest(queryText: string, requestHistoryId: string | null): Promise<CreateRequestResponse> {
    const payload = {
      query_text: queryText,
      request_history_id: requestHistoryId,
    };
    const response = await firstValueFrom(this.api.createRequest(payload));
    this.addPendingRequestSummary(response, queryText);
    this.startAutoMonitor(response.request_id);
    return response;
  }

  startAutoMonitor(id: string): void {
    if (!id || this._monitors.has(id) || !this.shouldMonitorRequest(id)) return;

    const entry: MonitorEntry = {
      unsubscribe: () => this.stopAutoMonitor(id),
      pollingId: null,
      lastInterval: this.getBaseInterval(),
      consecutiveErrors: 0,
      mode: 'background',
    };

    this._monitors.set(id, entry);
    void this.runPoll(id);
  }

  private startChatMonitor(id: string): void {
    if (!id || !this.shouldMonitorRequest(id, true)) return;
    const existing = this._monitors.get(id);
    if (existing?.mode === 'chat') return;
    this.stopAutoMonitor(id);

    const entry: MonitorEntry = {
      unsubscribe: () => this.stopAutoMonitor(id),
      pollingId: null,
      lastInterval: this.getBaseInterval(),
      consecutiveErrors: 0,
      mode: 'chat',
    };

    this._monitors.set(id, entry);
    void this.runPoll(id);
  }

  stopAutoMonitor(id: string): void {
    const entry = this._monitors.get(id);
    if (!entry) return;
    this.clearTimer(entry.pollingId);
    this._monitors.delete(id);
  }

  resetMonitorForRequest(id: string): void {
    const entry = this._monitors.get(id);
    if (!entry) return;
    entry.lastInterval = this.getBaseInterval();
    this.clearTimer(entry.pollingId);
    entry.pollingId = this.setTimer(() => {
      void this.runPoll(id);
    }, entry.lastInterval);
  }

  private async runPoll(id: string): Promise<void> {
    const entry = this._monitors.get(id);
    if (!entry) return;
    if (!this.shouldContinuePolling(id, entry)) return;

    try {
      const payload = await firstValueFrom(this.api.getRequestStatusById(id));
      entry.consecutiveErrors = 0;
      const shouldKeepPolling = this.applySuccessPayload(id, payload, entry);
      if (!shouldKeepPolling) return;
    } catch {
      entry.consecutiveErrors += 1;
      if (entry.consecutiveErrors >= this.getMaxErrors()) {
        entry.unsubscribe();
        return;
      }
    }

    this.scheduleNext(id, entry);
  }

  private applySuccessPayload(
    id: string,
    payload: RequestStatusResponse,
    entry: MonitorEntry,
  ): boolean {
    const current = { ...(this._requests() || {}) };
    const existing = current[id];
    const status = payload.status;
    const lastUpdated = payload.last_updated ?? payload.updated_at ?? new Date().toISOString();
    current[id] = {
      request_id: id,
      title: existing?.title ?? '',
      snippet: existing?.snippet ?? '',
      status,
      last_updated: lastUpdated,
    };
    this._requests.set(current);
    if (entry.mode === 'chat' && this.isDisplayedInChatPanel(id) && this.isCompletedStatus(status)) {
      this.selectedStore.startResultStream(id);
    }

    if (!this.isPendingStatus(status)) {
      entry.unsubscribe();
      return false;
    }
    return true;
  }

  private scheduleNext(id: string, entry: MonitorEntry): void {
    const nextInterval =
      entry.mode === 'chat' ? this.getBaseInterval() : this.computeNextInterval(entry.lastInterval);
    entry.lastInterval = nextInterval;
    entry.pollingId = this.setTimer(() => {
      void this.runPoll(id);
    }, nextInterval);
  }

  private shouldContinuePolling(id: string, entry: MonitorEntry): boolean {
    if (entry.mode === 'background' && this.isDisplayedInChatPanel(id)) {
      entry.unsubscribe();
      return false;
    }
    const snapshot = this._requests()[id];
    if (!snapshot) {
      entry.unsubscribe();
      return false;
    }
    if (!this.isPendingStatus(snapshot.status)) {
      entry.unsubscribe();
      return false;
    }
    return true;
  }

  private shouldMonitorRequest(id: string, allowDisplayed = false): boolean {
    if (!id) return false;
    if (!allowDisplayed && this.isDisplayedInChatPanel(id)) return false;
    const request = this._requests()[id];
    if (!request) return false;
    return this.isPendingStatus(request.status);
  }

  private isDisplayedInChatPanel(id: string): boolean {
    const displayedId = this.selectedStore.selectedId();
    return Boolean(displayedId && displayedId === id);
  }

  private isPendingStatus(status: RequestStatus | string | undefined | null): boolean {
    return typeof status === 'string' && status.toLowerCase() === 'pending';
  }

  private isCompletedStatus(status: RequestStatus | string | undefined | null): boolean {
    return typeof status === 'string' && status.toLowerCase() === 'completed';
  }

  private computeNextInterval(current: number): number {
    const minInterval = Math.max(REQUEST_POLLING_CONFIG.requestPollingMinMs ?? 1000, 0);
    const maxInterval = Math.max(minInterval, REQUEST_POLLING_CONFIG.requestPollingMaxMs ?? 60000);
    const multiplier = Math.max(REQUEST_POLLING_CONFIG.pollingMultiplier ?? 1.2, 1);
    let next = Math.round(Math.min(current * multiplier, maxInterval));
    if (next < minInterval) next = minInterval;
    const jitter = Math.round(next * 0.1);
    if (jitter > 0) {
      const random = Math.floor(Math.random() * (jitter * 2 + 1)) - jitter;
      next = Math.max(minInterval, Math.min(next + random, maxInterval));
    }
    return next;
  }

  private getBaseInterval(): number {
    const minInterval = Math.max(REQUEST_POLLING_CONFIG.requestPollingMinMs ?? 1000, 0);
    const baseInterval = REQUEST_POLLING_CONFIG.requestPollingIntervalMs ?? 1000;
    return Math.max(minInterval, baseInterval);
  }

  private getMaxErrors(): number {
    return Math.max(1, REQUEST_POLLING_CONFIG.pollingMaxConsecutiveErrorsBeforeStop ?? 5);
  }

  private addPendingRequestSummary(response: CreateRequestResponse, queryText: string): void {
    if (!response?.request_id) return;
    const next: Record<string, RequestSummary> = { ...(this._requests() || {}) };
    next[response.request_id] = {
      request_id: response.request_id,
      title: this.buildTitleFromQuery(queryText),
      snippet: queryText,
      status: 'pending',
      last_updated: response.submitted_at ?? new Date().toISOString(),
    };
    this._requests.set(next);
  }

  private buildTitleFromQuery(queryText: string): string {
    const trimmed = (queryText ?? '').trim();
    if (!trimmed) {
      return 'New Request';
    }
    return trimmed.length <= 48 ? trimmed : trimmed.slice(0, 48);
  }
}
