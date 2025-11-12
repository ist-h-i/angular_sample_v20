import { Injectable, signal, computed } from '@angular/core';

export interface AiModelOption {
  id: string;
  label: string;
}

const DEFAULT_AI_MODEL_ID = 'gpt-4o-mini';
const AI_MODEL_OPTIONS: AiModelOption[] = [
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast)' },
  { id: 'gpt-4o', label: 'GPT-4o' },
  { id: 'gpt-4o-reasoning', label: 'GPT-4o Reasoning' },
];

@Injectable({ providedIn: 'root' })
export class AiModelSelectionStore {
  private readonly _selectedModelId = signal(DEFAULT_AI_MODEL_ID);

  readonly selectedModelId = this._selectedModelId.asReadonly();
  readonly options = computed(() => AI_MODEL_OPTIONS);

  setSelectedModel(id: string): void {
    if (!AI_MODEL_OPTIONS.some((model) => model.id === id)) {
      return;
    }
    this._selectedModelId.set(id);
  }
}
