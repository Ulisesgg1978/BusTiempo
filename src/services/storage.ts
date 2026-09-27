import { FavoriteItem, ActiveAlert } from '../types/transit';
import { TransitNetwork } from './transitData';

const FAVORITES_KEY = 'bustiempo_favorites_v1';
const CACHED_NETWORK_KEY = 'bustiempo_network_cache_v1';
const ALERTS_KEY = 'bustiempo_active_alerts_v1';
const THEME_KEY = 'bustiempo_theme_mode';
const SETTINGS_KEY = 'bustiempo_user_settings';

export interface UserSettings {
  alertThresholdMeters: number; // e.g. 500
  alertThresholdMinutes: number; // e.g. 3
  soundEnabled: boolean;
  vibrateEnabled: boolean;
  searchRadiusMeters: number; // e.g. 1000
}

export const DEFAULT_SETTINGS: UserSettings = {
  alertThresholdMeters: 500,
  alertThresholdMinutes: 3,
  soundEnabled: true,
  vibrateEnabled: true,
  searchRadiusMeters: 1000,
};

// Favorites
export function getStoredFavorites(): FavoriteItem[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveFavorite(item: FavoriteItem): FavoriteItem[] {
  const current = getStoredFavorites();
  const exists = current.some((f) => f.id === item.id);
  let updated: FavoriteItem[];
  if (exists) {
    updated = current.filter((f) => f.id !== item.id);
  } else {
    updated = [item, ...current];
  }
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save favorite:', e);
  }
  return updated;
}

export function removeFavorite(id: string): FavoriteItem[] {
  const current = getStoredFavorites().filter((f) => f.id !== id);
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(current));
  } catch (e) {
    console.error('Failed to remove favorite:', e);
  }
  return current;
}

// Active Alerts
export function getStoredAlerts(): ActiveAlert[] {
  try {
    const raw = localStorage.getItem(ALERTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAlerts(alerts: ActiveAlert[]): void {
  try {
    localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
  } catch (e) {
    console.error('Failed to save alerts:', e);
  }
}

// Offline Network Cache
export function cacheNetworkLocally(network: TransitNetwork): void {
  try {
    localStorage.setItem(CACHED_NETWORK_KEY, JSON.stringify(network));
  } catch (e) {
    console.error('Failed to cache network locally:', e);
  }
}

export function getCachedNetwork(): TransitNetwork | null {
  try {
    const raw = localStorage.getItem(CACHED_NETWORK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Ignore legacy small mock cache of 18 stops so real TMB full network loads
    if (!parsed || !Array.isArray(parsed.stops) || parsed.stops.length <= 25) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// User Settings
export function getStoredSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveStoredSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

// Theme
export function getStoredTheme(): 'dark' | 'light' {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === 'dark' || raw === 'light') return raw;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    // fallback
  }
  return 'dark'; // Default to sleek dark mode for high-contrast transit UI
}

export function saveStoredTheme(theme: 'dark' | 'light'): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (e) {
    console.error('Failed to save theme:', e);
  }
}
