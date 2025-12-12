import { Component, effect, inject } from '@angular/core';
import { SelectedRequestStore } from '../../../../../shared/core/stores/selected-request.store';

@Component({
  selector: 'app-thinking-panel',
  standalone: true,
  templateUrl: './thinking-panel.html',
  styleUrl: './thinking-panel.scss',
})
export class ThinkingPanel {
  private readonly selectedStore = inject(SelectedRequestStore);
  public manualThinkingPanelOpen = false;

  constructor() {
    effect(() => {
      const thinking = this.selectedStore.thinkingProcess();
      if (!thinking || thinking.isStreaming) {
        this.manualThinkingPanelOpen = false;
      }
    });
  }

  public toggleThinkingPanel(): void {
    this.manualThinkingPanelOpen = !this.manualThinkingPanelOpen;
  }

  public hasThinkingContent(): boolean {
    const thinking = this.selectedStore.thinkingProcess();
    if (!thinking) return false;
    const hasRaw = Boolean(thinking.raw?.trim());
    const hasPhases = Boolean(thinking.phases?.length);
    return hasRaw || hasPhases;
  }

  public isThinkingExpanded(): boolean {
    return this.isStreamingThinking() || this.manualThinkingPanelOpen;
  }

  public isStreamingThinking(): boolean {
    return Boolean(this.selectedStore.thinkingProcess()?.isStreaming);
  }

  public shouldLimitThinkingPanelHeight(): boolean {
    const thinking = this.selectedStore.thinkingProcess();
    return Boolean(thinking?.isStreaming && !this.manualThinkingPanelOpen);
  }

  public thinkingToggleIcon(): string {
    return this.isThinkingExpanded() ? '▲' : '▼';
  }

  public thinkingPhases(): Array<{ title: string; steps: string[] }> {
    return this.selectedStore.thinkingProcess()?.phases ?? [];
  }

  public hasThinkingPhases(): boolean {
    return this.thinkingPhases().length > 0;
  }

  public thinkingRaw(): string {
    return this.selectedStore.thinkingProcess()?.raw ?? '';
  }
}
