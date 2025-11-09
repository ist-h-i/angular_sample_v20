import { Injectable, computed, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { RequestDetail } from '../models/request.model';
import { ApiService } from '../services/api.service';

@Injectable({ providedIn: 'root' })
export class SelectedRequestStore {
  private readonly _selectedId = signal<string | null>(null);
  private readonly _detail = signal<RequestDetail | null>(null);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _error = signal<unknown | null>(null);

  readonly selectedId = this._selectedId.asReadonly();
  readonly detail = this._detail.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  // Convenience derived values
  readonly hasDetail = computed(() => this._detail() != null);

  constructor(private readonly api: ApiService) {}

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

  clearSelection(): void {
    this._selectedId.set(null);
    this._detail.set(null);
    this._error.set(null);
    this._isLoading.set(false);
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
}
