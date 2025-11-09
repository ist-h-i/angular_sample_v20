import { Routes } from '@angular/router';
import { Home } from './shared/components/home/home';

export const routes: Routes = [
  { path: '**', component: Home },
];