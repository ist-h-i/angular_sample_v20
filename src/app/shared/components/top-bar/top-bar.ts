import { Component, Input, ViewChild, ElementRef, AfterViewInit, HostListener, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InitialDataStore } from '../../core/stores/initial-data.store';

@Component({
  selector: 'app-top-bar',
  imports: [RouterLink],
  templateUrl: './top-bar.html',
  styleUrl: './top-bar.scss',
})
export class TopBar implements AfterViewInit {
  /**
   * 見出しタイトル。テンプレート内で未指定の場合に表示されます。
   * 例: <app-top-bar [title]="'ダッシュボード'"></app-top-bar>
   */
  @Input() title?: string;

  @Input() subtitle?: string;
  @Input() logoSrc?: string;

  @ViewChild('topbar', { static: true })
  private topbarEl?: ElementRef<HTMLElement>;

  private readonly initialDataStore = inject(InitialDataStore);
  protected readonly isAdmin = computed(
    () => this.initialDataStore.initialData()?.user?.is_admin ?? false,
  );

  ngAfterViewInit(): void {
    this.updateTopbarHeightVar();
  }

  @HostListener('window:resize')
  onResize() {
    this.updateTopbarHeightVar();
  }

  private updateTopbarHeightVar(): void {
    // Guard against SSR and non-DOM environments
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const el = this.topbarEl?.nativeElement as unknown as { getBoundingClientRect?: () => { height: number } } | undefined;
    if (!el || typeof el.getBoundingClientRect !== 'function') {
      return;
    }

    const height = Math.round(el.getBoundingClientRect().height);
    if (document?.documentElement?.style?.setProperty) {
      // Expose globally so sibling routes can consume it
      document.documentElement.style.setProperty('--topbar-height', `${height}px`);
    }
  }

  onMediaLoaded(): void {
    // Recalculate after logo/fonts load which can change height
    this.updateTopbarHeightVar();
  }
}
