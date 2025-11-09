import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-primary-button',
  imports: [],
  templateUrl: './primary-button.html',
  styleUrl: './primary-button.scss',
})
export class PrimaryButton {
  /**
   * 表示ラベル。テンプレート内のコンテンツより優先して表示されます（injectionラベル）。
   * 例: <app-primary-button [label]="'保存'"></app-primary-button>
   */
  @Input() label?: string;

  /**
   * ボタンを無効化します。外部から injection 可能な disabled フラグ。
   * 例: <app-primary-button [disabled]="isSaving"></app-primary-button>
   */
  @Input() disabled = false;

  /**
   * 親コンポーネントから直接関数を渡してクリック時の処理を注入できます。
   * 例: <app-primary-button [onClick]="handleSave"></app-primary-button>
   * onClick が指定されれば先にそれを呼び、最後に clicked イベントを emit します。
   */
  @Input() onClick?: (event: MouseEvent) => void;

  /**
   * クリックイベントを購読できる EventEmitter。伝統的な (clicked) バインディング用。
   * 例: <app-primary-button (clicked)="onClicked($event)"></app-primary-button>
   */
  @Output() clicked = new EventEmitter<MouseEvent>();

  /**
   * テンプレートから呼ばれる内蔵ハンドラ。
   */
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
