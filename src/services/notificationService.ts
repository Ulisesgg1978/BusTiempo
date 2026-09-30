import { playTransitChime, triggerHaptic } from '../utils/geo';

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('[ServiceWorker] Registrado con éxito, scope:', registration.scope);
    return registration;
  } catch (err) {
    console.warn('[ServiceWorker] Error al registrar Service Worker:', err);
    return null;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      // Ensure Service Worker is ready for background notifications
      registerServiceWorker().catch(() => {});
    }
    return perm;
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
  data?: any;
  playSound?: boolean;
  vibrate?: boolean;
}

/**
 * Sends notifications utilizing the registered Service Worker to guarantee delivery
 * even when the tab is in background, minimized, or screen locked.
 */
export async function sendProximityNotification({
  title,
  body,
  icon = '/bus-icon.svg',
  tag,
  data,
  playSound = true,
  vibrate = true,
}: SendAlertParams): Promise<void> {
  // 1. Audio & Haptics (in-tab feedback if document has focus)
  if (playSound) {
    playTransitChime();
  }
  if (vibrate) {
    triggerHaptic([250, 100, 250, 100, 350]);
  }

  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const notificationOptions = {
    body,
    icon,
    badge: '/bus-icon.svg',
    tag: tag || 'bus-proximity-alert',
    renotify: true,
    data: data || '/',
    vibrate: [250, 100, 250, 100, 350],
    actions: [
      { action: 'open', title: 'Ver en Mapa 🗺️' },
      { action: 'dismiss', title: 'Cerrar' },
    ],
  };

  // 2. Primary Method: Use registered Service Worker (works in background & PWA)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, notificationOptions);

        // Also post message to service worker client
        if (reg.active) {
          reg.active.postMessage({
            type: 'SHOW_NOTIFICATION',
            title,
            options: notificationOptions,
          });
        }
        return;
      }
    } catch (e) {
      console.warn('[NotificationService] Service Worker notification fallback:', e);
    }
  }

  // 3. Fallback to window.Notification if service worker was not available
  try {
    new Notification(title, notificationOptions);
  } catch (err) {
    console.warn('[NotificationService] Direct Notification error:', err);
  }
}

/**
 * Schedules a background transit alert through the registered Service Worker.
 * Guaranteed to fire even if the browser tab is backgrounded, minimized, or screen locked.
 */
export async function scheduleBackgroundAlert(
  title: string,
  body: string,
  delayMs = 5000,
  tag = 'bustiempo-scheduled-alert'
): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    if (reg.active) {
      reg.active.postMessage({
        type: 'SCHEDULE_BACKGROUND_ALERT',
        title,
        options: {
          body,
          tag,
          icon: '/bus-icon.svg',
          badge: '/bus-icon.svg',
          vibrate: [300, 150, 300, 150, 450],
          renotify: true,
          data: '/',
        },
        delayMs,
      });
      return true;
    }
  } catch (err) {
    console.warn('[NotificationService] scheduleBackgroundAlert error:', err);
  }

  return false;
}

/**
 * Test background push notification in N seconds (allows user to leave app and test background alert)
 */
export async function triggerBackgroundTestNotification(delaySeconds = 5): Promise<boolean> {
  const perm = await requestNotificationPermission();
  if (perm !== 'granted') {
    return false;
  }

  return scheduleBackgroundAlert(
    '🚌 BusTiempo Barcelona (Segundo Plano)',
    `¡Tu autobús línea H12 está a 200m de la parada! Alerta despachada en segundo plano por el Service Worker (${delaySeconds}s después).`,
    delaySeconds * 1000,
    `test-bg-${Date.now()}`
  );
}
