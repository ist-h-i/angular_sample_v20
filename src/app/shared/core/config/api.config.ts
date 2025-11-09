import { InjectionToken, Provider } from '@angular/core';

export interface ApiConfig {
  baseUrl: string; // e.g. '/api' or 'https://api.example.com'
}

export const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG');

export function provideApiConfig(config: ApiConfig): Provider {
  return { provide: API_CONFIG, useValue: config };
}

