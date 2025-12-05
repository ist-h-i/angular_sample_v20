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
    if (typeof localStorage === 'undefined') {
      return true;
    }
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(NotificationPreferenceStore.STORAGE_KEY);
    } catch {
      return true;
    }
    if (stored === 'false') {
      return false;
    }
    if (stored === 'true') {
      return true;
    }
    return true;
  }

  private writePreference(value: boolean): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(
        NotificationPreferenceStore.STORAGE_KEY,
        value ? 'true' : 'false',
      );
    } catch {
      // ignore write failures (e.g. storage blocked) to keep app running
    }
  }
}
