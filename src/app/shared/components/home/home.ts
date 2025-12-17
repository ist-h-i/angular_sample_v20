import { Component, AfterViewInit, inject, signal } from '@angular/core';
import { RequestQueue } from '../../../features/request-queue/components/pages/request-queue/request-queue';
import { ChatPanel } from '../../../features/chat-panel/components/pages/chat-panel/chat-panel';
import { AnnotationList } from '../../../features/annotation-list/components/pages/annotation-list/annotation-list';
import { InitialDataStore } from '../../core/stores/initial-data.store';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RequestQueue, ChatPanel, AnnotationList],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements AfterViewInit {
  private readonly initialDataStore = inject(InitialDataStore);
  readonly requestPanelOpen = signal(true);
  readonly annotationPanelOpen = signal(true);

  ngAfterViewInit(): void {
    // Defer to ensure child views are ready before kicking off initial load
    setTimeout(() => {
      try {
        if (this.initialDataStore.initialData() || this.initialDataStore.isLoading()) return;
      } catch {
        // Defensive: proceed with revalidate even if getters are not ready
      }
      void this.initialDataStore.revalidate();
    }, 0);
  }

  toggleRequestPanel(): void {
    this.requestPanelOpen.update((open) => !open);
  }

  toggleAnnotationPanel(): void {
    this.annotationPanelOpen.update((open) => !open);
  }
}
