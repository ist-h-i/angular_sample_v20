import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly notifiedIds = new Set<string>();
  private permissionRequest: Promise<NotificationPermission> | null = null;

  async notifyRequestComplete(title: string, id: string, body?: string): Promise<void> {
    if (!this.isSupported() || this.notifiedIds.has(id)) return;

    const granted = await this.ensurePermission();
    if (!granted) return;

    const notificationTitle = title?.trim() ? title : 'Request completed';
    const options = body?.trim() ? { body } : undefined;
    new Notification(notificationTitle, options);
    this.notifiedIds.add(id);
  }

  private isSupported(): boolean {
    return typeof window !== 'undefined' && typeof Notification !== 'undefined';
  }

  private async ensurePermission(): Promise<boolean> {
    if (!this.isSupported()) return false;

    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;

    if (!this.permissionRequest) {
      this.permissionRequest = Notification.requestPermission();
    }

    try {
      const result = await this.permissionRequest;
      return result === 'granted';
    } finally {
      this.permissionRequest = null;
    }
  }
}
