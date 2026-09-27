import { playTransitChime, triggerHaptic } from '../utils/geo';

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    return await Notification.requestPermission();
  } catch (e) {
    console.warn('Could not request notification permission:', e);
    return 'denied';
  }
}

export function hasNotificationPermission(): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  return Notification.permission === 'granted';
}

export interface SendAlertParams {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  playSound?: boolean;
  vibrate?: boolean;
}

export function sendProximityNotification({
  title,
  body,
  icon = '/bus-icon.svg',
  tag,
  playSound = true,
  vibrate = true,
}: SendAlertParams): void {
  // Audio & Haptics
  if (playSound) {
    playTransitChime();
  }
  if (vibrate) {
    triggerHaptic([200, 100, 300, 100, 400]);
  }

  // System Notification
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon,
        tag: tag || 'bus-proximity-alert',
        badge: '/bus-icon.svg',
      });
    } catch {
      // If direct constructor fails (e.g. in some mobile browser contexts requiring service worker),
      // attempt via registration
      if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(title, {
            body,
            icon,
            tag: tag || 'bus-proximity-alert',
          }).catch(() => {});
        });
      }
    }
  }
}
