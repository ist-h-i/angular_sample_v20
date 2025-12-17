import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import type { ErrorResponse } from '../models/error-response.model';
import { ErrorDialogService } from '../services/error-dialog.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const errorDialog = inject(ErrorDialogService);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        const status = err.status;
        const raw = err.error;

        const normalized: ErrorResponse = typeof raw === 'object' && raw && 'error' in raw
          ? (raw as ErrorResponse)
          : {
              error: {
                code: status ? `HTTP_${status}` : 'unknown_error',
                message: (typeof raw === 'string' && raw) || err.message || 'Request failed',
                details: { url: req.url }
              }
            };

        // Keep HttpErrorResponse shape but replace error with normalized
        const wrapped = new HttpErrorResponse({
          error: normalized,
          headers: err.headers,
          status: err.status,
          statusText: err.statusText,
          url: err.url || req.url
        });

        if (wrapped.status !== 200) {
          errorDialog.showError(wrapped);
        }

        return throwError(() => wrapped);
      }
      return throwError(() => err);
    })
  );
};
