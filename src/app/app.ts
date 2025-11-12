import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AiWarningDialog } from './shared/components/ai-warning-dialog/ai-warning-dialog';
import { TopBar } from './shared/components/top-bar/top-bar';
import { AiWarningNoticeService } from './shared/core/services/ai-warning-notice.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TopBar, AiWarningDialog],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected readonly title = signal('angular_sample_v20');
  protected readonly showAiWarning = signal(false);
  private readonly aiWarningNoticeService = inject(AiWarningNoticeService);

  ngOnInit(): void {
    if (this.aiWarningNoticeService.shouldShowNotice()) {
      this.showAiWarning.set(true);
      this.aiWarningNoticeService.registerDisplayed();
    }
  }

  protected handleAiWarningClosed(): void {
    this.showAiWarning.set(false);
  }
}
