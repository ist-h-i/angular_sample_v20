import { Component, Input } from '@angular/core';
import { AiModelSelector } from '../ai-model-selector/ai-model-selector';

@Component({
  selector: 'app-top-bar',
  imports: [AiModelSelector],
  templateUrl: './top-bar.html',
  styleUrl: './top-bar.scss',
})
export class TopBar {
  @Input() title?: string;
}
