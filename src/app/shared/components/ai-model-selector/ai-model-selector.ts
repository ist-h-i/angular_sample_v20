import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiModelSelectionStore } from '../../core/stores/ai-model-selection.store';

@Component({
  selector: 'app-ai-model-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ai-model-selector.html',
  styleUrl: './ai-model-selector.scss',
})
export class AiModelSelector {
  private readonly store = inject(AiModelSelectionStore);
  readonly options = this.store.options;
  readonly selectedModelId = this.store.selectedModelId;

  onModelChange(event: Event): void {
    const value = (event.target as HTMLSelectElement | null)?.value;
    if (value) {
      this.store.setSelectedModel(value);
    }
  }
}
