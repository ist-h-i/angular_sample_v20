import { Component, computed, inject } from '@angular/core';
import { JsonPipe, NgIf } from '@angular/common';
import { ErrorDialogService } from '../../core/services/error-dialog.service';

@Component({
  selector: 'app-error-dialog',
  standalone: true,
  imports: [NgIf, JsonPipe],
  templateUrl: './error-dialog.html',
  styleUrl: './error-dialog.scss'
})
export class ErrorDialog {
  private readonly dialogService = inject(ErrorDialogService);

  readonly error = computed(() => this.dialogService.error());

  close(): void {
    this.dialogService.close();
  }

  formatDetails(details: unknown): string {
    if (details === undefined || details === null) return '';
    if (typeof details === 'string') return details;
    try {
      return JSON.stringify(details, null, 2);
    } catch {
      return String(details);
    }
  }
}
