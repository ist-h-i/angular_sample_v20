import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AiModelSelectionStore {
  private readonly _selectedModelId = signal<string | null>(null);
  readonly selectedModelId = this._selectedModelId.asReadonly();

  selectModel(id: string | null): void {
    this._selectedModelId.set(id);
  }

  resetSelection(): void {
    this._selectedModelId.set(null);
  }
}
