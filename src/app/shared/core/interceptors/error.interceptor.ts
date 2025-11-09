import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import type { ErrorResponse } from '../models/error-response.model';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
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
        return throwError(() => wrapped);
      }
      return throwError(() => err);
    })
  );
};
