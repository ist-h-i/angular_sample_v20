import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopBar } from './shared/components/top-bar/top-bar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TopBar],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('angular_sample_v20');
}
