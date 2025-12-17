import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopBar } from './shared/components/top-bar/top-bar';
import { ErrorDialog } from './shared/components/error-dialog/error-dialog';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TopBar, ErrorDialog],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('angular_sample_v20');
}
