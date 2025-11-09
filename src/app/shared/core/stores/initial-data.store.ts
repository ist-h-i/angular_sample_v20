import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { InitialData } from '../models/initial-data.model';
import { ApiService } from '../services/api.service';

@Injectable({ providedIn: 'root' })
export class InitialDataStore {
  private readonly _initialData = signal<InitialData | null>(null);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<unknown | null>(null);

  // Expose as read-only signals
  readonly initialData = this._initialData.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  constructor(private readonly api: ApiService) {}

  async revalidate(): Promise<void> {
    if (this._isLoading()) return;
    this._isLoading.set(true);
    try {
      const data = await firstValueFrom(this.api.getInitialData());
      this._initialData.set(data ?? null);
      this._error.set(null);
    } catch (err) {
      this._error.set(err);
    } finally {
      this._isLoading.set(false);
    }
  }
}

