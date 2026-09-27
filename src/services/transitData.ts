import { BusLine, BusStop, LiveBus, Arrival } from '../types/transit';
import { getDistanceMeters, getBearing } from '../utils/geo';
import {
  BARCELONA_LINES,
  BARCELONA_STOPS,
  getBarcelonaTransitNetwork,
} from '../data/barcelonaTransit';

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
 * Generates initial live moving buses for active lines
 */
export function generateBusesForTmbLines(lines: BusLine[], stops: BusStop[]): LiveBus[] {
  const buses: LiveBus[] = [];
  const linesWithPaths = lines.filter((l) => l.path && l.path.length >= 3);
  const activeLines = linesWithPaths.slice(0, 40);

  activeLines.forEach((line, lIdx) => {
    const path = line.path;
    const midIdx = Math.floor(path.length * 0.35);
    const pos = path[midIdx] || path[0];
    const nextPos = path[Math.min(path.length - 1, midIdx + 1)] || pos;
    const heading = Math.round(getBearing(pos[0], pos[1], nextPos[0], nextPos[1]));

    const nearestStop = line.stops && line.stops.length > 0
      ? line.stops[0]
      : (stops[lIdx % stops.length]?.id || 'stop-1');

    buses.push({
      id: `bus-tmb-${line.code}-1`,
      lineCode: line.code,
      plate: `TMB-${line.code}-${2100 + lIdx}`,
      lat: pos[0],
      lng: pos[1],
      heading,
      speedKmh: 24,
      nextStopId: nearestStop,
      distanceToNextStopMeters: 180,
      occupancy: lIdx % 3 === 0 ? 'low' : lIdx % 3 === 1 ? 'medium' : 'high',
      isAccessible: true,
    });
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
 * Step simulation: Advances buses along their paths and updates stop ETAs
 */
export function stepSimulation(network: TransitNetwork): TransitNetwork {
  const updatedBuses = network.buses.map((bus) => {
    const line = network.lines.find((l) => l.code === bus.lineCode);
    if (!line || line.path.length < 2) return bus;

    // Move bus slightly towards next target coordinate along line.path
    const targetStop = network.stops.find((s) => s.id === bus.nextStopId) || network.stops[0];
    if (!targetStop) return bus;

    const bearing = getBearing(bus.lat, bus.lng, targetStop.lat, targetStop.lng);
    const distToStop = getDistanceMeters(bus.lat, bus.lng, targetStop.lat, targetStop.lng);

    // If close to current target stop (< 45m), pick next stop along the line
    let nextStopId = bus.nextStopId;
    if (distToStop < 45 && line.stops && line.stops.length > 0) {
      const stopList = line.stops;
      const currentIdx = stopList.indexOf(bus.nextStopId);
      const nextIdx = (currentIdx + 1) % stopList.length;
      nextStopId = stopList[nextIdx];
    }

    const stepDistanceDeg = 0.00012; // roughly 13 meters
    const rad = (bearing * Math.PI) / 180;
    const newLat = bus.lat + Math.cos(rad) * stepDistanceDeg;
    const newLng = bus.lng + Math.sin(rad) * stepDistanceDeg * 1.3;

    return {
      ...bus,
      lat: newLat,
      lng: newLng,
      heading: bearing,
      nextStopId,
      distanceToNextStopMeters: Math.max(20, distToStop - 15),
      speedKmh: Math.min(48, Math.max(16, bus.speedKmh + (Math.random() - 0.5) * 4)),
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
