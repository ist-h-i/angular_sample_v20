import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideApiConfig } from './shared/core/config/api.config';
import { endpointInterceptor } from './shared/core/interceptors/endpoint.interceptor';
import { errorInterceptor } from './shared/core/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    // Base API endpoint and HTTP interceptors
    provideApiConfig({
      // Set your API base URL here (e.g. '/api' or full origin)
      // You can switch to an env-driven value if needed
      baseUrl: '/api'
    }),
    provideHttpClient(
      withFetch(),
      withInterceptors([endpointInterceptor, errorInterceptor])
    )
  ]
};
