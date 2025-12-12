import { Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

export interface DialogErrorPayload {
  status: number;
  statusText?: string;
  code?: string;
  message?: string;
  details?: unknown;
  name?: string;
  url?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ErrorDialogService {
  private readonly _error = signal<DialogErrorPayload | null>(null);

  readonly error = this._error.asReadonly();

  private isErrorEnvelope(value: unknown): value is {
    error?: { code?: string; message?: string; details?: unknown };
  } {
    return typeof value === 'object' && value !== null && 'error' in value;
  }

  showError(error: HttpErrorResponse): void {
    if (error.status === 200) return;

    const raw = error.error;
    const nested = this.isErrorEnvelope(raw) ? raw.error : null;

    const payload: DialogErrorPayload = {
      status: error.status,
      statusText: error.statusText || undefined,
      code: nested?.code ?? (error.status ? `HTTP_${error.status}` : undefined),
      message: nested?.message ?? error.message ?? undefined,
      details: nested?.details ?? (typeof raw === 'string' ? raw : undefined),
      name: error.name || error.constructor?.name,
      url: error.url ?? null,
    };

    this._error.set(payload);
  }

  close(): void {
    this._error.set(null);
  }
}
