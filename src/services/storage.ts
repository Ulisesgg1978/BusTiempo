import { FavoriteItem, ActiveAlert, RecentDestination, DestinationFavorite } from '../types/transit';
import { TransitNetwork } from './transitData';

const FAVORITES_KEY = 'bustiempo_favorites_v1';
const CACHED_NETWORK_KEY = 'bustiempo_network_cache_v1';
const ALERTS_KEY = 'bustiempo_active_alerts_v1';
const THEME_KEY = 'bustiempo_theme_mode';
const SETTINGS_KEY = 'bustiempo_user_settings';
const RECENT_DESTINATIONS_KEY = 'bustiempo_recent_destinations_v1';
const FAVORITE_DESTINATIONS_KEY = 'bustiempo_favorite_destinations_v1';

export interface UserSettings {
  alertThresholdMeters: number; // e.g. 500
  alertThresholdMinutes: number; // e.g. 3
  soundEnabled: boolean;
  vibrateEnabled: boolean;
  searchRadiusMeters: number; // e.g. 1000
  busFilterMode: 'in_radius' | 'all' | 'matches_only'; // default 'in_radius'
}

export const DEFAULT_SETTINGS: UserSettings = {
  alertThresholdMeters: 500,
  alertThresholdMinutes: 3,
  soundEnabled: true,
  vibrateEnabled: true,
  searchRadiusMeters: 1000,
  busFilterMode: 'in_radius',
};

// Recent Destinations (max 3 items as requested)
export function getStoredRecentDestinations(): RecentDestination[] {
  try {
    const raw = localStorage.getItem(RECENT_DESTINATIONS_KEY);
    return raw ? JSON.parse(raw).slice(0, 3) : [];
  } catch {
    return [];
  }
}

export function saveRecentDestination(point: { lat: number; lng: number; name?: string }): RecentDestination[] {
  try {
    const recents = getStoredRecentDestinations();
    // Exclude if already within 50 meters
    const filtered = recents.filter(
      (r) => Math.hypot(r.lat - point.lat, r.lng - point.lng) > 0.0005
    );
    const newEntry: RecentDestination = {
      id: `recent-${Date.now()}`,
      name: point.name || 'Destino seleccionado',
      lat: point.lat,
      lng: point.lng,
      timestamp: Date.now(),
    };
    const updated = [newEntry, ...filtered].slice(0, 3);
    localStorage.setItem(RECENT_DESTINATIONS_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to save recent destination:', e);
    return [];
  }
}

// Destination Favorites
export const DEFAULT_DESTINATION_FAVORITES: DestinationFavorite[] = [
  {
    id: 'fav-home',
    name: 'Casa (Pl. Catalunya / Centre)',
    category: 'home',
    lat: 41.3879,
    lng: 2.1699,
    icon: '🏠',
    createdAt: Date.now() - 100000,
  },
  {
    id: 'fav-work',
    name: 'Trabajo (Diagonal / Francesc Macià)',
    category: 'work',
    lat: 41.3934,
    lng: 2.1447,
    icon: '💼',
    createdAt: Date.now() - 90000,
  },
  {
    id: 'fav-gym',
    name: 'Gimnasio (Sagrada Família)',
    category: 'gym',
    lat: 41.4036,
    lng: 2.1744,
    icon: '🏋️',
    createdAt: Date.now() - 80000,
  },
];

export function getStoredDestinationFavorites(): DestinationFavorite[] {
  try {
    const raw = localStorage.getItem(FAVORITE_DESTINATIONS_KEY);
    if (!raw) {
      localStorage.setItem(FAVORITE_DESTINATIONS_KEY, JSON.stringify(DEFAULT_DESTINATION_FAVORITES));
      return DEFAULT_DESTINATION_FAVORITES;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_DESTINATION_FAVORITES;
  }
}

export function saveDestinationFavorite(fav: DestinationFavorite): DestinationFavorite[] {
  try {
    const current = getStoredDestinationFavorites();
    const exists = current.some((f) => f.id === fav.id);
    let updated: DestinationFavorite[];
    if (exists) {
      updated = current.map((f) => (f.id === fav.id ? fav : f));
    } else {
      updated = [fav, ...current];
    }
    localStorage.setItem(FAVORITE_DESTINATIONS_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to save destination favorite:', e);
    return [];
  }
}

export function removeDestinationFavorite(id: string): DestinationFavorite[] {
  try {
    const current = getStoredDestinationFavorites();
    const updated = current.filter((f) => f.id !== id);
    localStorage.setItem(FAVORITE_DESTINATIONS_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to remove destination favorite:', e);
    return [];
  }
}

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

// Offline Network Cache with IndexedDB + localStorage fallback
const IDB_NAME = 'bustiempo_offline_transit_v2';
const IDB_STORE = 'network_store';

function openOfflineDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// Memory cache for instantaneous sync queries
let memoryNetworkCache: TransitNetwork | null = null;

export async function cacheNetworkLocally(network: TransitNetwork): Promise<void> {
  memoryNetworkCache = network;

  // 1. Save to IndexedDB (unlimited capacity for high-density Barcelona transit geometry)
  try {
    const db = await openOfflineDB();
    if (db) {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(network, 'latest_network');
    }
  } catch (e) {
    console.warn('[Storage] IndexedDB put error:', e);
  }

  // 2. Also keep in localStorage (with try/catch against quota exceeded)
  try {
    localStorage.setItem(CACHED_NETWORK_KEY, JSON.stringify(network));
  } catch (e) {
    console.warn('[Storage] LocalStorage quota fallback:', e);
  }
}

export function getCachedNetwork(): TransitNetwork | null {
  if (memoryNetworkCache) return memoryNetworkCache;

  try {
    const raw = localStorage.getItem(CACHED_NETWORK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.stops) || parsed.stops.length <= 10) {
      return null;
    }
    memoryNetworkCache = parsed;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Loads the complete cached network asynchronously from IndexedDB
 * (guaranteed full resolution of all routes and stops when offline)
 */
export async function loadCachedNetworkFromIDB(): Promise<TransitNetwork | null> {
  if (memoryNetworkCache && memoryNetworkCache.stops.length > 50) {
    return memoryNetworkCache;
  }

  try {
    const db = await openOfflineDB();
    if (!db) return getCachedNetwork();

    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get('latest_network');
      req.onsuccess = () => {
        if (req.result && Array.isArray(req.result.stops) && req.result.stops.length > 10) {
          memoryNetworkCache = req.result;
          resolve(req.result);
        } else {
          resolve(getCachedNetwork());
        }
      };
      req.onerror = () => resolve(getCachedNetwork());
    });
  } catch {
    return getCachedNetwork();
  }
}

/**
 * Returns cached stops sorted by proximity to the query coordinates,
 * allowing full nearest stops query when completely offline.
 */
export async function getCachedStopsOffline(
  lat: number,
  lng: number,
  radiusMeters = 1000
) {
  const net = await loadCachedNetworkFromIDB();
  if (!net || !net.stops) return [];

  return net.stops
    .map((stop) => {
      const dLat = (stop.lat - lat) * 111320;
      const dLng = (stop.lng - lng) * (40075000 * Math.cos((lat * Math.PI) / 180) / 360);
      const distance = Math.hypot(dLat, dLng);
      return { ...stop, distanceToUser: Math.round(distance) };
    })
    .filter((s) => s.distanceToUser <= radiusMeters)
    .sort((a, b) => a.distanceToUser - b.distanceToUser);
}

/**
 * Returns cached lines and their route trajectories when completely offline.
 */
export async function getCachedLinesOffline() {
  const net = await loadCachedNetworkFromIDB();
  return net?.lines || [];
}

/**
 * Checks whether persistent transit data is ready in local offline storage.
 */
export function isOfflineTransitAvailable(): boolean {
  if (memoryNetworkCache && memoryNetworkCache.stops.length > 10) return true;
  return Boolean(getCachedNetwork());
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
