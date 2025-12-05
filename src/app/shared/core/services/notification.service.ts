import { Injectable } from '@angular/core';
import { NotificationPreferenceStore } from '../stores/notification-preference.store';

type RichNotificationOptions = NotificationOptions & {
  renotify?: boolean;
  timestamp?: number;
};

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly notifiedIds = new Set<string>();
  private permissionRequest: Promise<NotificationPermission> | null = null;
  private readonly appName = 'Sample App';
  private readonly iconUrl = '/favicon.ico';

  constructor(private readonly preferenceStore: NotificationPreferenceStore) {}

  async notifyRequestComplete(title: string, id: string, body?: string): Promise<void> {
    if (!this.preferenceStore.isEnabled()) return;
    if (!this.isSupported() || this.notifiedIds.has(id)) return;

    const granted = await this.ensurePermission();
    if (!granted) return;

    const requestTitle = title?.trim() ? title.trim() : 'Request completed';
    const snippet = this.formatSnippet(body);
    const notificationTitle = this.appName;
    const notificationBody = [requestTitle, snippet].filter(Boolean).join('\n');

    const options: RichNotificationOptions = {
      body: notificationBody || 'Your request has finished processing.',
      icon: this.iconUrl,
      badge: this.iconUrl,
      tag: `request-${id}`,
      renotify: true,
      timestamp: Date.now(),
      data: {
        appName: this.appName,
        requestId: id,
      },
    };

    const notification = new Notification(notificationTitle, options);
    notification.onclick = () => {
      if (typeof window !== 'undefined' && typeof window.focus === 'function') {
        window.focus();
      }
      notification.close();
    };
    this.notifiedIds.add(id);
  }

  private isSupported(): boolean {
    return typeof window !== 'undefined' && typeof Notification !== 'undefined';
  }

  private formatSnippet(snippet?: string): string {
    const trimmed = snippet?.trim() ?? '';
    if (!trimmed) return '';
    return trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed;
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
