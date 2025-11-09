import { Component, OnInit, computed, inject } from '@angular/core';
import { PrimaryButton } from '../../../../../shared/ui/primary-button/primary-button';
import { SecondaryButton } from '../../../../../shared/ui/secondary-button/secondary-button';
import { Request } from '../../ui/request/request';
import type { RequestSummary } from '../../../../../shared/core/models/request-summary.model';
import { RequestFacade } from './request.facade';
import { SelectedRequestStore } from '../../../../../shared/core/stores/selected-request.store';

@Component({
  selector: 'app-request-queue',
  standalone: true,
  imports: [PrimaryButton, SecondaryButton, Request],
  templateUrl: './request-queue.html',
  styleUrl: './request-queue.scss',
})
export class RequestQueue implements OnInit {
  private readonly facade = inject(RequestFacade);
  private readonly selectedStore = inject(SelectedRequestStore);

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
  trackByCreated(index: number, item: Record<string, unknown> | undefined): string | number {
    const PrimitiveKey: string | number | undefined =
      (item?.['created'] as any) ?? (item?.['request_id'] as any);
    return (PrimitiveKey as any) ?? index;
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
    // Load detail for panel/annotations and start monitoring status updates on the summary
    await this.selectedStore.select(id);
    this.facade.startAutoMonitor(id);
    this.facade.resetMonitorForRequest(id);
  }

  private restartPollingForCurrentRequests(): void {
    const raw = this.facade.requests ? this.facade.requests() : {};
    const records: Record<string, unknown> =
      typeof raw === 'function'
        ? (raw as () => Record<string, unknown>)()
        : (raw as Record<string, unknown>);
    for (const id of Object.keys(records || {})) {
      this.facade.startAutoMonitor(id);
      this.facade.resetMonitorForRequest(id);
    }
  }
}
