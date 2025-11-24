import { inject } from '@angular/core';
import type { CanActivateFn, CanDeactivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { InitialDataStore } from '../../../shared/core/stores/initial-data.store';
import type { Settings } from '../components/pages/settings/settings';

export const adminRouteGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const initialDataStore = inject(InitialDataStore);

  if (!initialDataStore.initialData() && !initialDataStore.isLoading()) {
    await initialDataStore.revalidate();
  }

  const user = initialDataStore.initialData()?.user;
  const isAdmin = Boolean(user?.is_admin);

  if (!isAdmin) {
    void router.navigate(['/']);
  }

  return isAdmin;
};

export const adminEditingGuard: CanDeactivateFn<Settings> = (component) => {
  if (component?.isEditing?.()) {
    if (typeof window !== 'undefined') {
      window.alert('編集中です。決定ボタンで保存してから画面を離れてください。');
    }
    return false;
  }
  return true;
};
