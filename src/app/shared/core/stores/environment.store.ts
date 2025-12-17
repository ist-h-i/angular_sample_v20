import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { EnvironmentVariable } from '../models/environment-variable.model';
import { ApiService } from '../services/api.service';

@Injectable({ providedIn: 'root' })
export class EnvironmentStore {
  private readonly _entries = signal<EnvironmentVariable[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _isSaving = signal(false);
  private readonly _error = signal<unknown | null>(null);
  private readonly _saveError = signal<unknown | null>(null);

  readonly entries = this._entries.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();
  readonly error = this._error.asReadonly();
  readonly saveError = this._saveError.asReadonly();

  constructor(private readonly api: ApiService) {}

  async load(): Promise<void> {
    if (this._isLoading()) return;
    this._isLoading.set(true);
    try {
      const data = await firstValueFrom(this.api.getEnvironmentVariables());
      this._entries.set(data ?? []);
      this._error.set(null);
    } catch (err) {
      this._error.set(err);
    } finally {
      this._isLoading.set(false);
    }
  }

  async persist(entries: EnvironmentVariable[]): Promise<void> {
    if (this._isSaving()) return;
    this._isSaving.set(true);
    try {
      const response = await firstValueFrom(this.api.updateEnvironmentVariables(entries));
      this._entries.set(response ?? []);
      this._saveError.set(null);
    } catch (err) {
      this._saveError.set(err);
      throw err;
    } finally {
      this._isSaving.set(false);
    }
  }
}
