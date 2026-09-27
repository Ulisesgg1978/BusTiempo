/**
 * Geographical and utilities helper for BusTiempo
 */

// Calculate Haversine distance in meters
export function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

// Format distance to user friendly string
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

// Calculate compass bearing between two points
export function getBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

// Format countdown ETA
export function formatETA(seconds: number): {
  text: string;
  badgeClass: string;
  isImminent: boolean;
} {
  if (seconds <= 45) {
    return {
      text: 'Llegando ahora',
      badgeClass: 'bg-emerald-500 text-white animate-pulse',
      isImminent: true,
    };
  }

  const minutes = Math.ceil(seconds / 60);

  if (minutes <= 1) {
    return {
      text: '1 min',
      badgeClass: 'bg-emerald-500 text-white',
      isImminent: true,
    };
  }
  if (minutes <= 4) {
    return {
      text: `${minutes} min`,
      badgeClass: 'bg-amber-500 text-white',
      isImminent: true,
    };
  }
  if (minutes <= 12) {
    return {
      text: `${minutes} min`,
      badgeClass: 'bg-blue-600 text-white',
      isImminent: false,
    };
  }

  return {
    text: `${minutes} min`,
    badgeClass: 'bg-slate-600 text-slate-100',
    isImminent: false,
  };
}

// Play modern transit arrival chime using Web Audio API
export function playTransitChime(): void {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // Tone 1: 587.33 Hz (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Tone 2: 880.00 Hz (A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.0, now + 0.18);
    gain2.gain.setValueAtTime(0, now + 0.18);
    gain2.gain.linearRampToValueAtTime(0.25, now + 0.23);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.18);
    osc2.stop(now + 0.65);
  } catch (err) {
    console.debug('Audio chime unable to play:', err);
  }
}

// Trigger device vibration
export function triggerHaptic(pattern: number | number[] = [100, 50, 150]): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignore unsupported vibration
  }
}
