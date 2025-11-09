import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Annotation as AnnotationModel } from '../../../../../shared/core/models/annotation.model';

@Component({
  selector: 'app-annotation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './annotation.html',
  styleUrl: './annotation.scss',
})
export class Annotation {
  @Input() annotation:
    | (AnnotationModel & { title2?: string; snippet2?: string; usedText?: string })
    | null = null;

  @Input() idx = 0;

  show = false;

  toggleAccordion(): void {
    this.show = !this.show;
  }
}
