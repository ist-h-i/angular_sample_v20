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
  const isAllowed = Boolean(user?.is_admin || user?.is_support);

  if (!isAllowed) {
    void router.navigate(['/']);
  }

  return isAllowed;
};

export const adminEditingGuard: CanDeactivateFn<Settings> = (component) => {
  if (component?.isEditing?.()) {
    if (typeof window !== 'undefined') {
      window.alert('編集中の変更があります。離脱すると破棄されます。');
    }
    return false;
  }
  return true;
};
