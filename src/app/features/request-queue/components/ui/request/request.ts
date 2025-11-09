import { Component, EventEmitter, Input, Output, computed } from '@angular/core';
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
export class Request {
  @Input() request: RequestSummary | null = null;
  // When provided, component marks itself selected if ids match
  @Input() selectedRequestId: string | null = null;

  @Output() selectRequest = new EventEmitter<string>();

  readonly isSelected = computed(() => {
    const cur = this.request?.request_id ?? null;
    return cur != null && cur === (this.selectedRequestId ?? null);
  });

  // CSS class for status pill
  get statusPillClass(): string {
    const status = this.request?.status ?? '';
    const base = 'rq-status rq-status-pill px-3 py-1 rounded-full text-sm font-semibold';
    if (status === 'pending' || status === 'processing') return `${base} pending`;
    if (status === 'completed') return `${base} done`;
    if (status === 'failed') return `${base} error`;
    return base;
  }

  onClick(): void {
    const id = this.request?.request_id ?? null;
    if (id) this.selectRequest.emit(id);
  }
}
