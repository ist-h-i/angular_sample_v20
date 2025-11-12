import { Component, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

const statusMetadata: Record<number, { heading: string; description: string }> = {
  401: {
    heading: '401 Unauthorized',
    description: 'Authentication is required to access this resource. Please sign in again.'
  },
  404: {
    heading: '404 Not Found',
    description: 'We could not find the requested resource. Double-check the URL and try again.'
  },
  500: {
    heading: '500 Internal Server Error',
    description: 'Something went wrong on the server. Please try again later.'
  }
};

@Component({
  selector: 'app-error-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './error-page.html',
  styleUrl: './error-page.scss',
})
export class ErrorPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly statusCode = Number(this.route.snapshot.paramMap.get('status')) || 0;
  readonly metadata = statusMetadata[this.statusCode] ?? {
    heading: 'Unexpected Error',
    description: 'An unknown issue occurred. Please retry the request when you are ready.'
  };
  readonly detailMessage = (this.location.getState() as { message?: string })?.message;

  goHome(): void {
    void this.router.navigateByUrl('/');
  }
}
