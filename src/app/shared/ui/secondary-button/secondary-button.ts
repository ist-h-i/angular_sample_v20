import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-secondary-button',
  imports: [],
  templateUrl: './secondary-button.html',
  styleUrl: './secondary-button.scss',
})
export class SecondaryButton {
  /**
   * 表示ラベル。テンプレート内のコンテンツより優先して表示されます。
   * 例: <app-secondary-button [label]="'キャンセル'"></app-secondary-button>
   */
  @Input() label?: string;

  /**
   * ボタンを無効化します。
   * 例: <app-secondary-button [disabled]="isBusy"></app-secondary-button>
   */
  @Input() disabled = false;

  /**
   * 親からクリックハンドラを注入できます。onClick を先に実行し、最後に clicked を emit します。
   * 例: <app-secondary-button [onClick]="handleCancel"></app-secondary-button>
   */
  @Input() onClick?: (event: MouseEvent) => void;

  /**
   * クリックイベントを購読できる EventEmitter。
   * 例: <app-secondary-button (clicked)="onCancel($event)"></app-secondary-button>
   */
  @Output() clicked = new EventEmitter<MouseEvent>();

  handleClick(event: MouseEvent): void {
    if (this.disabled) {
      event.preventDefault();
      return;
    }
    try {
      this.onClick?.(event);
    } finally {
      this.clicked.emit(event);
    }
  }
}
