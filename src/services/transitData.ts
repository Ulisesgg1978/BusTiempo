import { BusLine, BusStop, LiveBus, Arrival } from '../types/transit';
import { getDistanceMeters, getBearing } from '../utils/geo';
import {
  BARCELONA_LINES,
  BARCELONA_STOPS,
  getBarcelonaTransitNetwork,
} from '../data/barcelonaTransit';
import { loadCachedNetworkFromIDB } from './storage';

export interface TransitNetwork {
  cityName: string;
  center: [number, number];
  stops: BusStop[];
  lines: BusLine[];
  buses: LiveBus[];
}

export interface TransitStatusResponse {
  status: string;
  primaryCity: string;
  coverage: string[];
  tmb: {
    configured: boolean;
    verified?: boolean;
    appIdProvided: boolean;
    providerName: string;
    portalUrl: string;
    statusNote?: string;
    linesCount?: number;
    stopsCount?: number;
    lastUpdated?: string | null;
    isLoading?: boolean;
  };
  message: string;
}

export interface StopArrivalsResult {
  arrivals: Arrival[];
  isLive: boolean;
  provider: string;
  stopCode: string;
  requiresCredentials?: boolean;
  invalidCredentials?: boolean;
  message?: string;
}

export const PRESET_HUBS = [
  { name: 'Barcelona - Pl. Catalunya / Rambles', center: [41.3879, 2.1699] as [number, number], region: 'Barcelona' },
  { name: 'Barcelona - Sagrada Família', center: [41.4036, 2.1744] as [number, number], region: 'Barcelona' },
  { name: 'Barcelona - Sants Estació (AVE/Bus)', center: [41.3792, 2.1402] as [number, number], region: 'Barcelona' },
  { name: 'Barcelona - Pl. Espanya / Fira', center: [41.3748, 2.1485] as [number, number], region: 'Barcelona' },
  { name: 'Barcelona - Passeig de Gràcia / Casa Batlló', center: [41.3912, 2.1648] as [number, number], region: 'Barcelona' },
  { name: 'Barcelona - Diagonal / Francesc Macià', center: [41.3934, 2.1447] as [number, number], region: 'Barcelona' },
  { name: 'Barcelona - Glòries / Torre Glòries', center: [41.4031, 2.1892] as [number, number], region: 'Barcelona' },
  { name: 'Barcelona - Barceloneta / Port Vell', center: [41.3768, 2.1895] as [number, number], region: 'Barcelona' },
  { name: 'Barcelona - Camp Nou (Les Corts)', center: [41.3780, 2.1190] as [number, number], region: 'Barcelona' },
  { name: 'Barcelona - Arc de Triomf / Ciutadella', center: [41.3915, 2.1806] as [number, number], region: 'Barcelona' },
];

/**
 * Generates live moving buses for all active transit lines
 */
export function generateBusesForTmbLines(lines: BusLine[], stops: BusStop[]): LiveBus[] {
  const buses: LiveBus[] = [];
  const stopMap = new Map(stops.map((s) => [s.id, s]));

  lines.forEach((line, lIdx) => {
    let path = line.path;
    if (!path || path.length < 2) {
      if (line.stops && line.stops.length >= 2) {
        path = line.stops
          .map((sId) => stopMap.get(sId))
          .filter((s): s is BusStop => Boolean(s))
          .map((s) => [s.lat, s.lng] as [number, number]);
      }
    }

    if (!path || path.length < 2) {
      return;
    }

    const numBuses = line.frequencyMinutes <= 7 || path.length > 30 ? 2 : 1;

    for (let bIdx = 0; bIdx < numBuses; bIdx++) {
      const fraction = numBuses === 1 ? 0.45 : (bIdx === 0 ? 0.25 : 0.75);
      const midIdx = Math.floor(path.length * fraction) % path.length;
      const pos = path[midIdx] || path[0];
      const nextIdx = (midIdx + 1) % path.length;
      const nextPos = path[nextIdx] || pos;
      const heading = Math.round(getBearing(pos[0], pos[1], nextPos[0], nextPos[1]));

      const stopIdx = Math.floor(fraction * (line.stops?.length || 1));
      const nearestStop = line.stops && line.stops.length > 0
        ? (line.stops[stopIdx] || line.stops[0])
        : (stops[lIdx % stops.length]?.id || 'stop-1');

      buses.push({
        id: `bus-tmb-${line.code}-${bIdx + 1}`,
        lineCode: line.code,
        plate: `TMB-${line.code}-${2000 + lIdx * 3 + bIdx}`,
        lat: pos[0],
        lng: pos[1],
        heading,
        speedKmh: Math.floor(20 + Math.random() * 8),
        nextStopId: nearestStop,
        distanceToNextStopMeters: Math.floor(100 + Math.random() * 200),
        occupancy: (lIdx + bIdx) % 3 === 0 ? 'low' : (lIdx + bIdx) % 3 === 1 ? 'medium' : 'high',
        isAccessible: true,
        pathIndex: midIdx,
        pathProgress: 0,
        transportType: line.transportType || (line.code.startsWith('L') || line.code === 'FM' ? 'metro' : 'bus'),
      });
    }
  });

  return buses;
}

/**
 * Fetches the entire official TMB Barcelona network in real-time from the backend
 */
export async function fetchTmbNetwork(
  centerLat = 41.3879,
  centerLng = 2.1699,
  cityName = 'Barcelona - Red TMB Oficial'
): Promise<TransitNetwork> {
  try {
    const [linesRes, stopsRes] = await Promise.all([
      fetch('/api/transit/barcelona/lines'),
      fetch('/api/transit/barcelona/stops'),
    ]);

    if (linesRes.ok && stopsRes.ok) {
      const linesData = await linesRes.json();
      const stopsData = await stopsRes.json();

      const lines: BusLine[] = Array.isArray(linesData.lines) && linesData.lines.length > 0
        ? linesData.lines
        : BARCELONA_LINES;

      const stops: BusStop[] = Array.isArray(stopsData.stops) && stopsData.stops.length > 0
        ? stopsData.stops
        : BARCELONA_STOPS;

      const buses: LiveBus[] = generateBusesForTmbLines(lines, stops);

      return {
        cityName,
        center: [centerLat, centerLng],
        stops,
        lines,
        buses,
      };
    }
  } catch (err) {
    console.warn('[TransitData] Error al obtener red completa de TMB:', err);
  }

  // If network is offline, attempt to restore complete real network from IndexedDB
  try {
    const offlineCached = await loadCachedNetworkFromIDB();
    if (offlineCached && offlineCached.stops && offlineCached.stops.length > 20) {
      console.log(`[TransitData] ⚡ Modo sin conexión activo: Restablecida red completa offline desde IndexedDB (${offlineCached.stops.length} paradas, ${offlineCached.lines.length} líneas)`);
      const buses = generateBusesForTmbLines(offlineCached.lines, offlineCached.stops);
      return {
        ...offlineCached,
        cityName: offlineCached.cityName || 'Barcelona (Modo Offline)',
        center: [centerLat, centerLng],
        buses,
      };
    }
  } catch (e) {
    console.warn('[TransitData] IndexedDB offline restore error:', e);
  }

  return generateNetworkForLocation(centerLat, centerLng, cityName);
}

/**
 * Fallback local network generator
 */
export function generateNetworkForLocation(centerLat: number, centerLng: number, cityName = 'Barcelona - Pl. Catalunya / Rambles'): TransitNetwork {
  const bcn = getBarcelonaTransitNetwork();
  return {
    ...bcn,
    cityName,
    center: [centerLat, centerLng],
  };
}

/**
 * Computes arrivals for a stop based on real bus distance and schedules
 */
export function calculateStopArrivals(
  stop: BusStop,
  lines: BusLine[],
  buses: LiveBus[]
): Arrival[] {
  const arrivals: Arrival[] = [];

  stop.lines.forEach((lineCode) => {
    const line = lines.find((l) => l.code === lineCode);
    if (!line) return;

    // Find buses running on this line
    const lineBuses = buses.filter((b) => b.lineCode === lineCode);

    lineBuses.forEach((bus, bIdx) => {
      const dist = getDistanceMeters(bus.lat, bus.lng, stop.lat, stop.lng);
      const baseSeconds = Math.max(30, Math.round(dist / 7.5) + bIdx * 120);

      arrivals.push({
        id: `arr-${stop.id}-${bus.id}`,
        lineId: line.id,
        lineCode: line.code,
        destination: line.destination,
        etaSeconds: baseSeconds,
        distanceMeters: dist,
        busPlate: bus.plate,
        occupancy: bus.occupancy,
        isAccessible: bus.isAccessible,
        busLocation: [bus.lat, bus.lng],
        speedKmh: bus.speedKmh,
        lineColor: line.color,
        lineTextColor: line.textColor,
      });
    });
  });

  // Sort by earliest arrival
  return arrivals.sort((a, b) => a.etaSeconds - b.etaSeconds);
}

/**
 * Step simulation: Advances buses strictly along line path coordinates
 */
export function stepSimulation(network: TransitNetwork): TransitNetwork {
  const updatedBuses = network.buses.map((bus) => {
    const line = network.lines.find((l) => l.code === bus.lineCode);
    if (!line || !line.path || line.path.length < 2) return bus;

    const path = line.path;
    let curIndex =
      typeof bus.pathIndex === 'number' && bus.pathIndex >= 0 && bus.pathIndex < path.length
        ? bus.pathIndex
        : 0;
    let curProgress = typeof bus.pathProgress === 'number' ? bus.pathProgress : 0;

    const isNearEnd = curIndex >= path.length - 1;
    const pFrom = isNearEnd && curIndex > 0 ? path[curIndex - 1] : path[curIndex];
    const pTo = isNearEnd ? path[curIndex] : path[(curIndex + 1) % path.length];
    const segDist = Math.max(3, getDistanceMeters(pFrom[0], pFrom[1], pTo[0], pTo[1]));

    // In ~2.5s tick at ~22 km/h (6.1 m/s), vehicle moves ~15.2 meters
    const speedMps = (bus.speedKmh || 22) / 3.6;
    const stepMeters = speedMps * 2.5;

    curProgress += stepMeters / segDist;

    while (curProgress >= 1) {
      curProgress -= 1;
      curIndex = (curIndex + 1) % path.length;
    }

    const startPt = path[curIndex];
    const nextIdx = (curIndex + 1) % path.length;
    const endPt = curIndex === path.length - 1 && curIndex > 0 ? path[curIndex] : path[nextIdx];

    // Mathematically strict on-road interpolation: point is always on the road segment
    const newLat = startPt[0] + (endPt[0] - startPt[0]) * curProgress;
    const newLng = startPt[1] + (endPt[1] - startPt[1]) * curProgress;

    // Heading calculation: avoid terminus cross-city vector
    let heading = bus.heading;
    if (curIndex < path.length - 1) {
      heading = Math.round(getBearing(path[curIndex][0], path[curIndex][1], path[curIndex + 1][0], path[curIndex + 1][1]));
    } else if (curIndex > 0) {
      heading = Math.round(getBearing(path[curIndex - 1][0], path[curIndex - 1][1], path[curIndex][0], path[curIndex][1]));
    }

    let nextStopId = bus.nextStopId;
    if (line.stops && line.stops.length > 0) {
      const stopProgressIdx = Math.floor((curIndex / path.length) * line.stops.length);
      nextStopId = line.stops[(stopProgressIdx + 1) % line.stops.length] || line.stops[0];
    }

    return {
      ...bus,
      lat: newLat,
      lng: newLng,
      heading,
      pathIndex: curIndex,
      pathProgress: curProgress,
      nextStopId,
      speedKmh: Math.min(42, Math.max(16, bus.speedKmh + (Math.random() - 0.5) * 2)),
    };
  });

  return {
    ...network,
    buses: updatedBuses,
  };
}

/**
 * Fetches transit status and API connection information from backend
 */
export async function getTransitStatus(): Promise<TransitStatusResponse | null> {
  try {
    const res = await fetch('/api/transit/status');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Transit status fetch error:', err);
  }
  return null;
}

/**
 * Fetches real-time arrivals for a Barcelona stop code from the backend server
 */
export async function getRealtimeStopArrivals(stopCode: string): Promise<StopArrivalsResult> {
  try {
    const cleanCode = stopCode.replace(/^[^\d]+/, '').replace(/^0+/, '') || stopCode;
    const res = await fetch(`/api/transit/barcelona/arrivals/${encodeURIComponent(cleanCode)}`);
    if (res.ok) {
      const data = await res.json();
      return {
        arrivals: Array.isArray(data.arrivals) ? data.arrivals : [],
        isLive: Boolean(data.isLive),
        provider: data.provider || 'TMB iBus',
        stopCode: data.stopCode || cleanCode,
        requiresCredentials: Boolean(data.requiresCredentials),
        invalidCredentials: Boolean(data.invalidCredentials),
        message: data.message,
      };
    }
  } catch (err) {
    console.warn('Realtime stop arrivals fetch error:', err);
  }
  return {
    arrivals: [],
    isLive: false,
    provider: 'TMB Barcelona Oficial',
    stopCode,
    message: 'Error de conexión con el servidor.',
  };
}
