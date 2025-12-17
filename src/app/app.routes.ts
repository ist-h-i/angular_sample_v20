import { Routes } from '@angular/router';
import { Home } from './shared/components/home/home';
import { Settings } from './features/admin/components/pages/settings/settings';
import { adminEditingGuard, adminRouteGuard } from './features/admin/guards/admin.guard';

export const routes: Routes = [
  {
    path: 'admin',
    component: Settings,
    canActivate: [adminRouteGuard],
    canDeactivate: [adminEditingGuard],
  },
  { path: '', component: Home },
  { path: '**', redirectTo: '' },
];
