import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';

@Component({
  selector: 'app-ai-warning-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ai-warning-dialog.html',
  styleUrls: ['./ai-warning-dialog.scss'],
})
export class AiWarningDialog {
  @Input() open = false;
  @Output() closed = new EventEmitter<void>();

  close(): void {
    this.closed.emit();
  }

  onBackdropClick(): void {
    this.close();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (!this.open) {
      return;
    }

    event.preventDefault();
    this.close();
  }
}
