import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_CONFIG } from '../config/api.config';

// Reads CP headers from sessionStorage/localStorage (if present)
function withCpHeaders(req: HttpRequest<unknown>): HttpRequest<unknown> {
  try {
    const uid = sessionStorage.getItem('X-NOM-GCD-UID') || localStorage.getItem('X-NOM-GCD-UID');
    const token = sessionStorage.getItem('X-NOM-LDAP-Token') || localStorage.getItem('X-NOM-LDAP-Token');
    const set: Record<string, string> = {};
    if (uid && !req.headers.has('X-NOM-GCD-UID')) set['X-NOM-GCD-UID'] = uid;
    if (token && !req.headers.has('X-NOM-LDAP-Token')) set['X-NOM-LDAP-Token'] = token;
    return Object.keys(set).length > 0 ? req.clone({ setHeaders: set }) : req;
  } catch {
    return req;
  }
}

export const endpointInterceptor: HttpInterceptorFn = (req, next) => {
  const { baseUrl } = inject(API_CONFIG);

  // Prefix baseUrl only for relative URLs
  const isAbsolute = /^(https?:)?\/\//i.test(req.url);
  const url = isAbsolute ? req.url : `${baseUrl?.replace(/\/$/, '') || ''}${req.url.startsWith('/') ? '' : '/'}${req.url}`;

  const withHeaders = withCpHeaders(req);
  return next(withHeaders.clone({ url }));
};

