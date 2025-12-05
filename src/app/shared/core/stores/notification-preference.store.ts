import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NotificationPreferenceStore {
  private static readonly STORAGE_KEY = 'notificationPreference.enabled';
  private readonly _isEnabled = signal<boolean>(this.readPreference());

  readonly isEnabled = this._isEnabled.asReadonly();

  toggle(): void {
    this.setEnabled(!this._isEnabled());
  }

  setEnabled(value: boolean): void {
    this._isEnabled.set(value);
    this.writePreference(value);
  }

  private readPreference(): boolean {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
      return true;
    }
    const stored = window.localStorage.getItem(NotificationPreferenceStore.STORAGE_KEY);
    if (stored === 'false') {
      return false;
    }
    if (stored === 'true') {
      return true;
    }
    return true;
  }

  private writePreference(value: boolean): void {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
      return;
    }
    window.localStorage.setItem(
      NotificationPreferenceStore.STORAGE_KEY,
      value ? 'true' : 'false',
    );
  }
}
