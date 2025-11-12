import { Routes } from '@angular/router';
import { Home } from './shared/components/home/home';
import { ErrorPage } from './shared/components/error-page/error-page';

export const routes: Routes = [
  { path: 'error/:status', component: ErrorPage },
  { path: '', component: Home, pathMatch: 'full' },
  { path: '**', component: Home },
];
