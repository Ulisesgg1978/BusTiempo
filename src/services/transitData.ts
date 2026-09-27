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
    appIdProvided: boolean;
    providerName: string;
    portalUrl: string;
  };
  emt: {
    configured: boolean;
    providerName: string;
    portalUrl: string;
  };
  message: string;
}

export const PRESET_HUBS = [
  { name: 'Barcelona - Pl. Catalunya / Rambles', center: [41.3879, 2.1699] as [number, number], region: 'Barcelona' },
  { name: 'Barcelona - Sagrada Família', center: [41.4036, 2.1744] as [number, number], region: 'Barcelona' },
  { name: 'Barcelona - Sants Estació (AVE/Bus)', center: [41.3792, 2.1402] as [number, number], region: 'Barcelona' },
  { name: 'Barcelona - Pl. Espanya / Fira', center: [41.3748, 2.1485] as [number, number], region: 'Barcelona' },
  { name: 'Barcelona - Passeig de Gràcia', center: [41.3912, 2.1648] as [number, number], region: 'Barcelona' },
  { name: 'Barcelona - Diagonal / Francesc Macià', center: [41.3934, 2.1447] as [number, number], region: 'Barcelona' },
  { name: 'Barcelona - Glòries / Torre Glòries', center: [41.4031, 2.1892] as [number, number], region: 'Barcelona' },
  { name: 'Barcelona - Barceloneta / Port Vell', center: [41.3768, 2.1895] as [number, number], region: 'Barcelona' },
  { name: 'Madrid - Gran Vía / Sol', center: [40.4194, -3.7038] as [number, number], region: 'España' },
  { name: 'Valencia - Pl. de l’Ajuntament', center: [39.4699, -0.3763] as [number, number], region: 'España' },
  { name: 'Sevilla - Plaza Nueva', center: [37.3891, -5.9984] as [number, number], region: 'España' },
];

const LINE_TEMPLATES = [
  { code: 'L1', name: 'Centro - Universidad', color: '#2563eb', textColor: '#ffffff', freq: 6 },
  { code: 'L4', name: 'Estación - Hospital General', color: '#16a34a', textColor: '#ffffff', freq: 8 },
  { code: 'C2', name: 'Circular Interior', color: '#ea580c', textColor: '#ffffff', freq: 5 },
  { code: 'E10', name: 'Express Aeropuerto', color: '#dc2626', textColor: '#ffffff', freq: 12 },
  { code: 'L7', name: 'Parque Tecnológico', color: '#9333ea', textColor: '#ffffff', freq: 10 },
  { code: 'N2', name: 'Nocturno Ramblas', color: '#0891b2', textColor: '#ffffff', freq: 15 },
];

const STOP_NAME_PREFIXES = [
  'Gran Vía', 'Av. Central', 'Plaza del Sol', 'Paseo de la Marina',
  'Estación Norte', 'Calle Mayor', 'Parque de la Alameda', 'Hospital Metropolitano',
  'Biblioteca Central', 'Mercado Municipal', 'Jardín Botánico', 'Bulevar Sur'
];

/**
 * Procedurally generates a realistic transit network centered on any coordinates,
 * or serves the authentic Barcelona TMB network when centered in Barcelona or requested.
 */
export function generateNetworkForLocation(centerLat: number, centerLng: number, cityName = 'Barcelona - Pl. Catalunya / Rambles'): TransitNetwork {
  const isBarcelonaArea =
    cityName.toLowerCase().includes('barcelona') ||
    cityName.toLowerCase().includes('tmb') ||
    (centerLat >= 41.28 && centerLat <= 41.52 && centerLng >= 2.02 && centerLng <= 2.28);

  if (isBarcelonaArea) {
    const bcn = getBarcelonaTransitNetwork();
    // Calculate initial arrivals for all Barcelona stops
    bcn.stops.forEach((stop) => {
      stop.nextArrivals = calculateStopArrivals(stop, bcn.lines, bcn.buses);
    });
    return {
      ...bcn,
      cityName,
      center: [centerLat, centerLng],
    };
  }

  // Generate 10 stops clustered around the center with realistic distances (100m - 900m)
  const stopOffsets = [
    { dLat: 0.0015, dLng: 0.0012, name: STOP_NAME_PREFIXES[0], address: 'Frente al cruce principal' },
    { dLat: -0.0018, dLng: -0.0015, name: STOP_NAME_PREFIXES[1], address: 'Puerta peatonal #4' },
    { dLat: 0.0028, dLng: -0.0021, name: STOP_NAME_PREFIXES[2], address: 'Esquina Bulevar Norte' },
    { dLat: -0.0031, dLng: 0.0025, name: STOP_NAME_PREFIXES[3], address: 'Junto al parque cívico' },
    { dLat: 0.0042, dLng: 0.0005, name: STOP_NAME_PREFIXES[4], address: 'Andén B intermodal' },
    { dLat: -0.0008, dLng: 0.0036, name: STOP_NAME_PREFIXES[5], address: 'Entrada comercio central' },
    { dLat: 0.0006, dLng: -0.0042, name: STOP_NAME_PREFIXES[6], address: 'Junto a ciclovía este' },
    { dLat: -0.0045, dLng: -0.0038, name: STOP_NAME_PREFIXES[7], address: 'Acceso urgencias' },
    { dLat: 0.0051, dLng: -0.0048, name: STOP_NAME_PREFIXES[8], address: 'Plaza universitaria' },
    { dLat: -0.0055, dLng: 0.0041, name: STOP_NAME_PREFIXES[9], address: 'Pabellón gastronómico' },
  ];

  const stops: BusStop[] = stopOffsets.map((offset, idx) => {
    const sLat = centerLat + offset.dLat;
    const sLng = centerLng + offset.dLng;
    const code = `${100 + idx * 12}`;
    
    // Assign 2 to 3 lines per stop
    const assignedLines = [
      LINE_TEMPLATES[idx % LINE_TEMPLATES.length].code,
      LINE_TEMPLATES[(idx + 2) % LINE_TEMPLATES.length].code,
    ];
    if (idx % 2 === 0) {
      assignedLines.push(LINE_TEMPLATES[(idx + 4) % LINE_TEMPLATES.length].code);
    }

    return {
      id: `stop-${idx + 1}`,
      code,
      name: `${offset.name} (${code})`,
      lat: sLat,
      lng: sLng,
      address: offset.address,
      lines: assignedLines,
      wheelchairAccessible: idx % 4 !== 0,
      shelter: idx % 3 !== 0,
      nextArrivals: [],
    };
  });

  // Generate lines connecting stops along smooth coordinates
  const lines: BusLine[] = LINE_TEMPLATES.map((tmpl, idx) => {
    // Pick 4-6 stops for this line
    const stopIds = stops
      .filter((s) => s.lines.includes(tmpl.code))
      .map((s) => s.id);

    // Build path coordinates through these stops plus intermediate road points
    const lineStops = stops.filter((s) => stopIds.includes(s.id));
    const path: [number, number][] = [];

    lineStops.forEach((st, sIdx) => {
      path.push([st.lat, st.lng]);
      if (sIdx < lineStops.length - 1) {
        const next = lineStops[sIdx + 1];
        // add intermediate curved road node
        const midLat = (st.lat + next.lat) / 2 + (idx % 2 === 0 ? 0.0006 : -0.0006);
        const midLng = (st.lng + next.lng) / 2 + (idx % 2 === 0 ? -0.0005 : 0.0005);
        path.push([midLat, midLng]);
      }
    });

    return {
      id: `line-${tmpl.code}`,
      code: tmpl.code,
      name: tmpl.name,
      color: tmpl.color,
      textColor: tmpl.textColor,
      origin: lineStops[0]?.name.split(' (')[0] || 'Terminal Norte',
      destination: lineStops[lineStops.length - 1]?.name.split(' (')[0] || 'Terminal Sur',
      frequencyMinutes: tmpl.freq,
      stops: stopIds,
      path: path.length > 0 ? path : [[centerLat, centerLng]],
    };
  });

  // Generate 8-12 live moving buses on lines
  const buses: LiveBus[] = [];
  const occupancies: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'medium', 'high'];

  lines.forEach((line, lIdx) => {
    // 2 buses per line
    for (let b = 0; b < 2; b++) {
      const busId = `bus-${line.code}-${b + 1}`;
      const pathNodes = line.path;
      const nodeIdx = (b * 2 + lIdx) % Math.max(1, pathNodes.length);
      const basePos = pathNodes[nodeIdx] || [centerLat, centerLng];
      const nextPos = pathNodes[(nodeIdx + 1) % pathNodes.length] || basePos;

      const heading = getBearing(basePos[0], basePos[1], nextPos[0], nextPos[1]);
      const nextStop = stops.find((s) => s.id === line.stops[b % line.stops.length]) || stops[0];

      buses.push({
        id: busId,
        lineCode: line.code,
        plate: `BUS-${1000 + lIdx * 100 + b * 17}`,
        lat: basePos[0] + (Math.random() - 0.5) * 0.0003,
        lng: basePos[1] + (Math.random() - 0.5) * 0.0003,
        heading,
        speedKmh: Math.floor(22 + Math.random() * 20),
        nextStopId: nextStop.id,
        distanceToNextStopMeters: 450,
        occupancy: occupancies[(lIdx + b) % occupancies.length],
        isAccessible: (lIdx + b) % 5 !== 0,
      });
    }
  });

  // Calculate arrivals for each stop
  stops.forEach((stop) => {
    stop.nextArrivals = calculateStopArrivals(stop, lines, buses);
  });

  return {
    cityName,
    center: [centerLat, centerLng],
    stops,
    lines,
    buses,
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
      // Rough ETA in seconds based on 30km/h average urban transit speed (8.33 m/s) + 40s per stop delay
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

    // If no active bus nearby, add estimated scheduled arrival based on line frequency
    if (lineBuses.length === 0) {
      arrivals.push({
        id: `arr-${stop.id}-${line.code}-sched`,
        lineId: line.id,
        lineCode: line.code,
        destination: line.destination,
        etaSeconds: line.frequencyMinutes * 60,
        distanceMeters: 1800,
        busPlate: `SCH-${line.code}`,
        occupancy: 'medium',
        isAccessible: true,
        busLocation: [stop.lat + 0.008, stop.lng + 0.008],
        speedKmh: 28,
        lineColor: line.color,
        lineTextColor: line.textColor,
      });
    }
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
    const bearing = getBearing(bus.lat, bus.lng, targetStop.lat, targetStop.lng);
    const distToStop = getDistanceMeters(bus.lat, bus.lng, targetStop.lat, targetStop.lng);

    // If close to current target stop (< 40m), pick next stop along the line
    let nextStopId = bus.nextStopId;
    if (distToStop < 45) {
      const stopList = line.stops;
      const currentIdx = stopList.indexOf(bus.nextStopId);
      const nextIdx = (currentIdx + 1) % stopList.length;
      nextStopId = stopList[nextIdx];
    }

    // Step distance: ~28 km/h = ~7.7 meters per second
    // In our tick of ~2s, step ~15 meters
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

  // Update arrivals on all stops
  const updatedStops = network.stops.map((stop) => {
    const newArrivals = calculateStopArrivals(stop, network.lines, updatedBuses);
    return {
      ...stop,
      nextArrivals: newArrivals,
    };
  });

  return {
    ...network,
    buses: updatedBuses,
    stops: updatedStops,
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
export async function getRealtimeStopArrivals(stopCode: string): Promise<Arrival[] | null> {
  try {
    const cleanCode = stopCode.replace(/^0+/, '') || stopCode;
    const res = await fetch(`/api/transit/barcelona/arrivals/${encodeURIComponent(cleanCode)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.arrivals) && data.arrivals.length > 0) {
        return data.arrivals;
      }
    }
  } catch (err) {
    console.warn('Realtime stop arrivals fetch error:', err);
  }
  return null;
}

