import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AiWarningNoticeService {
  private readonly storageKey = 'ai-warning-last-display-date';

  shouldShowNotice(): boolean {
    const today = this.getToday();
    return this.getLastDisplayedDate() !== today;
  }

  registerDisplayed(): void {
    this.setLastDisplayedDate(this.getToday());
  }

  private getToday(): string {
    return new Date().toISOString().split('T')[0];
  }

  private getLastDisplayedDate(): string | null {
    const storage = this.getStorage();
    if (!storage) {
      return null;
    }

    try {
      return storage.getItem(this.storageKey);
    } catch {
      return null;
    }
  }

  private setLastDisplayedDate(value: string): void {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }

    try {
      storage.setItem(this.storageKey, value);
    } catch {
      // ignore storage failures
    }
  }

  private getStorage(): Storage | null {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
      return null;
    }

    return window.localStorage;
  }
}
