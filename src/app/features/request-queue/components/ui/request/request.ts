import { Component, EventEmitter, Input, Output, computed, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { RequestSummary } from '../../../../../shared/core/models/request-summary.model';
import type { RequestStatus } from '../../../../../shared/core/models/request-status.model';

@Component({
  selector: 'app-request',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './request.html',
  styleUrl: './request.scss',
})
export class Request implements OnChanges, OnDestroy {
  @Input() request: RequestSummary | null = null;
  // When provided, component marks itself selected if ids match
  @Input() selectedRequestId: string | null = null;
  @Input() isNew = false;
  @Input() isSubmitting = false;
  @Input() disableSelect = false;

  @Output() selectRequest = new EventEmitter<string>();
  justCompleted = false;
  justFailed = false;
  private previousStatus: RequestStatus | null = null;
  private completeTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private failTimeoutId: ReturnType<typeof setTimeout> | null = null;

  readonly isSelected = computed(() => {
    const cur = this.request?.request_id ?? null;
    return cur != null && cur === (this.selectedRequestId ?? null);
  });

  get status(): RequestStatus | null {
    return this.request?.status ?? null;
  }

  get statusText(): string {
    if (this.isSubmitting) {
      return 'Sending…';
    }
    switch (this.status) {
      case 'pending':
        return 'Pending...';
      case 'processing':
        return 'Processing...';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      default:
        return '';
    }
  }

  // CSS class for status pill
  get statusPillClass(): string {
    const status = this.status ?? '';
    const base = 'rq-status rq-status-pill px-3 py-1 rounded-full text-sm font-semibold';
    if (this.isSubmitting) return `${base} pending`;
    if (status === 'pending' || status === 'processing') return `${base} pending`;
    if (status === 'completed') return `${base} done`;
    if (status === 'failed') return `${base} error`;
    return base;
  }

  get isBusy(): boolean {
    if (this.isSubmitting) return true;
    return this.status === 'pending' || this.status === 'processing';
  }

  get isProcessing(): boolean {
    return this.status === 'processing';
  }

  get statusLive(): 'polite' {
    return 'polite';
  }

  get statusLabel(): string | null {
    if (this.isSubmitting) return 'Status: Sending';
    return this.status ? `Status: ${this.statusText}` : null;
  }

  onClick(): void {
    if (this.disableSelect) return;
    const id = this.request?.request_id ?? null;
    if (id) this.selectRequest.emit(id);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['request']) {
      const nextStatus = this.status;
      this.handleStatusTransition(this.previousStatus, nextStatus);
      this.previousStatus = nextStatus;
    }
  }

  ngOnDestroy(): void {
    this.clearTransientTimers();
  }

  private handleStatusTransition(
    previous: RequestStatus | null,
    next: RequestStatus | null,
  ): void {
    const wasBusy = this.isPendingStatus(previous);
    const isBusyNow = this.isPendingStatus(next);

    if (isBusyNow) {
      this.justCompleted = false;
      this.justFailed = false;
    }

    if (wasBusy && !isBusyNow && next === 'completed') {
      this.triggerJustCompleted();
    } else if (wasBusy && !isBusyNow && next === 'failed') {
      this.triggerJustFailed();
    }

    if (!isBusyNow && !this.justCompleted) {
      this.clearCompleteTimer();
    }
    if (!isBusyNow && !this.justFailed) {
      this.clearFailTimer();
    }
  }

  private triggerJustCompleted(): void {
    this.justFailed = false;
    this.justCompleted = true;
    this.clearCompleteTimer();
    this.completeTimeoutId = setTimeout(() => {
      this.justCompleted = false;
    }, 650);
  }

  private triggerJustFailed(): void {
    this.justCompleted = false;
    this.justFailed = true;
    this.clearFailTimer();
    this.failTimeoutId = setTimeout(() => {
      this.justFailed = false;
    }, 650);
  }

  private clearTransientTimers(): void {
    this.clearCompleteTimer();
    this.clearFailTimer();
  }

  private clearCompleteTimer(): void {
    if (this.completeTimeoutId) {
      clearTimeout(this.completeTimeoutId);
      this.completeTimeoutId = null;
    }
  }

  private clearFailTimer(): void {
    if (this.failTimeoutId) {
      clearTimeout(this.failTimeoutId);
      this.failTimeoutId = null;
    }
  }

  private isPendingStatus(status: RequestStatus | null | undefined): boolean {
    return status === 'pending' || status === 'processing';
  }
}
