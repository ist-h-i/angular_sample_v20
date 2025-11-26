import { Component, computed, effect, inject, signal } from '@angular/core';
import { Annotation as AnnotationModel } from '../../../../../shared/core/models/annotation.model';
import { Annotation as AnnotationItemComponent } from '../../ui/annotation/annotation';
import { SelectedRequestStore } from '../../../../../shared/core/stores/selected-request.store';

@Component({
  selector: 'app-annotation-list',
  standalone: true,
  imports: [AnnotationItemComponent],
  templateUrl: './annotation-list.html',
  styleUrl: './annotation-list.scss',
})
export class AnnotationList {
  private readonly selectedStore = inject(SelectedRequestStore);
  // Simple local state for annotations
  private readonly _annotations = signal<AnnotationModel[]>([]);

  // Expose values to template
  annotations = computed(() => this._annotations());
  hasAnnotationsFlag = computed(() => this._annotations().length > 0);

  // Hydrate when selected request detail changes
  private readonly _hydrate = effect(() => {
    const detail = this.selectedStore.detail();
    const selectedIndex = this.selectedStore.selectedMessageIndex();
    const messages = detail?.messages ?? [];
    const selectedMessage =
      selectedIndex != null && selectedIndex >= 0 && selectedIndex < messages.length
        ? messages[selectedIndex]
        : null;
    const content = selectedMessage?.content ?? '';
    const annotations =
      selectedMessage?.annotations?.filter(annotation =>
        annotation?.url ? content.includes(annotation.url) : false,
      ) ?? [];
    this._annotations.set(annotations);
  });

  // API-like helpers
  setAnnotations(list: AnnotationModel[]): void {
    this._annotations.set(list ?? []);
  }

  add(annotation: AnnotationModel): void {
    this._annotations.update(cur => [annotation, ...cur]);
  }

  exportAll = (): void => {
    const payload = JSON.stringify(this._annotations(), null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'annotations.json';
    a.click();
    URL.revokeObjectURL(url);
  };
}
