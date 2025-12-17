import { Component, OnDestroy, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrimaryButton } from '../../../../../shared/ui/primary-button/primary-button';
import { SecondaryButton } from '../../../../../shared/ui/secondary-button/secondary-button';
import { Request } from '../../ui/request/request';
import type { RequestSummary } from '../../../../../shared/core/models/request-summary.model';
import { RequestFacade } from './request.facade';
import { SelectedRequestStore } from '../../../../../shared/core/stores/selected-request.store';

@Component({
  selector: 'app-request-queue',
  standalone: true,
  imports: [CommonModule, PrimaryButton, SecondaryButton, Request],
  templateUrl: './request-queue.html',
  styleUrl: './request-queue.scss',
})
export class RequestQueue implements OnInit, OnDestroy {
  private readonly facade = inject(RequestFacade);
  private readonly selectedStore = inject(SelectedRequestStore);
  private readonly knownRequests = signal<Map<string, string | null>>(new Map());
  private highlightTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Normalize facade store (record -> array)
  protected readonly requests = computed((): RequestSummary[] => {
    try {
      const storeRaw = this.facade.requests ? (this.facade.requests() as unknown) : {};
      const storeSnapshot: Record<string, unknown> =
        typeof storeRaw === 'function'
          ? (storeRaw as () => Record<string, unknown>)()
          : (storeRaw as Record<string, unknown>);
      return Object.values(storeSnapshot || {}).map((v) => v as unknown as RequestSummary);
    } catch {
      return [];
    }
  });

  protected readonly highlightedRequestId = signal<string | null>(null);
  protected readonly submittingExistingId = this.facade.submittingExistingId;

  protected readonly submittingPlaceholder = computed((): RequestSummary | null => {
    const draft = this.facade.submittingDraft();
    if (!draft) return null;
    return {
      request_id: `submitting-${draft.token}`,
      title: draft.title,
      snippet: draft.snippet,
      status: 'pending',
      last_updated: draft.startedAt,
    };
  });

  private readonly trackNewRequestsEffect = effect(() => {
    const list = this.requests();
    const previous = untracked(() => this.knownRequests());
    const next = new Map<string, string | null>();

    if (!list?.length) {
      if (previous.size) this.knownRequests.set(next);
      return;
    }

    if (!previous.size) {
      for (const req of list) {
        if (!req?.request_id) continue;
        next.set(req.request_id, req.last_updated ?? null);
      }
      this.knownRequests.set(next);
      return;
    }

    let highlightTarget: string | null = null;

    for (const req of list) {
      const id = req?.request_id;
      if (!id) continue;
      const updatedAt = req.last_updated ?? null;
      const isNew = !previous.has(id);
      const wasPendingRefreshed =
        !isNew &&
        req.status?.toLowerCase() === 'pending' &&
        updatedAt !== previous.get(id);

      if (isNew || wasPendingRefreshed) {
        highlightTarget = id;
      }

      next.set(id, updatedAt);
    }

    this.knownRequests.set(next);

    if (highlightTarget) {
      this.setHighlightedRequest(highlightTarget);
    }
  });

  private readonly highlightMessageActivityEffect = effect(() => {
    const activity = this.facade.recentActivity();
    const requestId = activity?.id ?? null;
    if (requestId) {
      this.setHighlightedRequest(requestId);
    }
  });

  ngOnInit(): void {
    void (async () => {
      const refreshPromise = this.facade.refreshStatuses();
      try {
        await refreshPromise;
      } finally {
        this.restartPollingForCurrentRequests();
      }
    })();
  }

  get requestsList(): RequestSummary[] {
    return this.requests();
  }

  // selected id for presentation (highlight)
  protected readonly selectedRequestId = computed(() => this.selectedStore.selectedId());

  // trackBy helper
  trackByCreated(index: number, item: RequestSummary | undefined): string | number {
    return item?.request_id ?? index;
  }

  refreshClick(): void {
    const refreshPromise = this.facade.refreshStatuses();
    Promise.resolve(refreshPromise).finally(() => {
      this.restartPollingForCurrentRequests();
    });
  }

  handleNewRequestClick(): void {
    const currentId = this.selectedStore.selectedId();
    if (currentId) {
      this.facade.stopAutoMonitor(currentId);
    }
    this.selectedStore.clearSelection();
  }

  async onSelectRequest(id: string): Promise<void> {
    // Load detail for panel/annotations; polling pauses while the request is displayed
    await this.selectedStore.select(id);
  }

  private restartPollingForCurrentRequests(): void {
    const raw = this.facade.requests ? this.facade.requests() : {};
    const records: Record<string, unknown> =
      typeof raw === 'function'
        ? (raw as () => Record<string, unknown>)()
        : (raw as Record<string, unknown>);
    const displayedId = this.selectedStore.selectedId();
    for (const id of Object.keys(records || {})) {
      if (id === displayedId) continue;
      this.facade.startAutoMonitor(id);
      this.facade.resetMonitorForRequest(id);
    }
  }

  ngOnDestroy(): void {
    this.trackNewRequestsEffect.destroy();
    this.highlightMessageActivityEffect.destroy();
    if (this.highlightTimeoutId) {
      clearTimeout(this.highlightTimeoutId);
      this.highlightTimeoutId = null;
    }
  }

  private setHighlightedRequest(id: string | null): void {
    this.highlightedRequestId.set(id);
    if (this.highlightTimeoutId) {
      clearTimeout(this.highlightTimeoutId);
    }
    if (id) {
      this.highlightTimeoutId = setTimeout(() => {
        this.highlightedRequestId.set(null);
        this.highlightTimeoutId = null;
      }, 1800);
    }
  }
}
