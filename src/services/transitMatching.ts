import {
  BusStop,
  BusLine,
  LiveBus,
  MatchStopRole,
  MatchedLineETA,
  TransitTransferSuggestion,
} from '../types/transit';
import { getDistanceMeters } from '../utils/geo';

/**
 * Finds the closest index along a route path for a given stop coordinate
 */
function findClosestPathIndex(path: [number, number][], lat: number, lng: number): number {
  if (!path || path.length === 0) return 0;
  let bestIdx = 0;
  let minDistance = Infinity;

  for (let i = 0; i < path.length; i++) {
    const d = getDistanceMeters(lat, lng, path[i][0], path[i][1]);
    if (d < minDistance) {
      minDistance = d;
      bestIdx = i;
    }
  }

  return bestIdx;
}

/**
 * Computes whether each stop serves IDA (towards destination) or VUELTA (return to origin)
 *
 * Requirements:
 * - Mark in one color (Emerald) stops of departure and arrival towards destination (IDA)
 * - Mark in another color (Rose/Coral) stops of departure and arrival for return (VUELTA)
 * - Mark with dual badge if stop serves both directions
 */
export function computeStopMatchRoles(
  stopsWithinOrigin: BusStop[],
  stopsWithinDest: BusStop[],
  matchedLines: BusLine[],
  allStops: BusStop[]
): Map<string, MatchStopRole> {
  const roles = new Map<string, MatchStopRole>();
  if (matchedLines.length === 0 || stopsWithinOrigin.length === 0 || stopsWithinDest.length === 0) {
    return roles;
  }

  const originStopIds = new Set(stopsWithinOrigin.map((s) => s.id));
  const originStopCodes = new Set(stopsWithinOrigin.map((s) => s.code));
  const destStopIds = new Set(stopsWithinDest.map((s) => s.id));
  const destStopCodes = new Set(stopsWithinDest.map((s) => s.code));

  // Temporary trackers for each stop: does it have outbound (IDA) role, return (VUELTA) role?
  const hasOutboundRole = new Set<string>();
  const hasReturnRole = new Set<string>();

  for (const line of matchedLines) {
    // 1. Identify which stops of this line are in origin and which are in destination
    const lineOriginStops = stopsWithinOrigin.filter(
      (s) => s.lines.includes(line.code) || (line.stops && (line.stops.includes(s.id) || line.stops.includes(s.code)))
    );
    const lineDestStops = stopsWithinDest.filter(
      (s) => s.lines.includes(line.code) || (line.stops && (line.stops.includes(s.id) || line.stops.includes(s.code)))
    );

    if (lineOriginStops.length === 0 || lineDestStops.length === 0) continue;

    for (const origStop of lineOriginStops) {
      for (const destStop of lineDestStops) {
        let isOrigBeforeDest = false;

        if (line.stops && line.stops.length >= 2) {
          const idxO = line.stops.findIndex((id) => id === origStop.id || id === origStop.code || id === `stop-${origStop.code}`);
          const idxD = line.stops.findIndex((id) => id === destStop.id || id === destStop.code || id === `stop-${destStop.code}`);

          if (idxO >= 0 && idxD >= 0) {
            isOrigBeforeDest = idxO < idxD;
          } else if (line.path && line.path.length >= 2) {
            const pIdxO = findClosestPathIndex(line.path, origStop.lat, origStop.lng);
            const pIdxD = findClosestPathIndex(line.path, destStop.lat, destStop.lng);
            isOrigBeforeDest = pIdxO < pIdxD;
          }
        } else if (line.path && line.path.length >= 2) {
          const pIdxO = findClosestPathIndex(line.path, origStop.lat, origStop.lng);
          const pIdxD = findClosestPathIndex(line.path, destStop.lat, destStop.lng);
          isOrigBeforeDest = pIdxO < pIdxD;
        }

        if (isOrigBeforeDest) {
          // Outbound trip (IDA): departure at origStop, arrival at destStop
          hasOutboundRole.add(origStop.id);
          hasOutboundRole.add(destStop.id);
        } else {
          // Return trip (VUELTA): departure at destStop, arrival at origStop
          hasReturnRole.add(destStop.id);
          hasReturnRole.add(origStop.id);
        }
      }
    }
  }

  // Combine roles for all involved stops
  const allInvolvedStops = new Set([...hasOutboundRole, ...hasReturnRole]);

  for (const stopId of allInvolvedStops) {
    const isOut = hasOutboundRole.has(stopId);
    const isRet = hasReturnRole.has(stopId);

    const isOrigin = originStopIds.has(stopId);
    const isDest = destStopIds.has(stopId);

    if (isOut && isRet) {
      roles.set(stopId, 'both');
    } else if (isOut) {
      // Outbound trip towards destination
      if (isOrigin) {
        roles.set(stopId, 'outbound_origin'); // Subida hacia destino
      } else if (isDest) {
        roles.set(stopId, 'outbound_dest'); // Llegada en destino
      } else {
        roles.set(stopId, 'outbound_origin');
      }
    } else if (isRet) {
      // Return trip back to origin
      if (isDest) {
        roles.set(stopId, 'return_dest'); // Subida para volver
      } else if (isOrigin) {
        roles.set(stopId, 'return_origin'); // Llegada de vuelta a origen
      } else {
        roles.set(stopId, 'return_dest');
      }
    }
  }

  return roles;
}

/**
 * Calculates dynamic estimated arrival times (ETAs) and door-to-door journey times
 *
 * Requirement 4:
 * When there is match, displays lines ordered by total arrival time to destination:
 * (walk to origin stop + wait time + transit time + walk from dest stop to destination)
 */
export function computeMatchedLineETAs(
  matchedLines: BusLine[],
  stopsWithinOrigin: BusStop[],
  stopsWithinDest: BusStop[],
  buses: LiveBus[],
  stopRoles: Map<string, MatchStopRole>,
  originLat = 41.3879,
  originLng = 2.1699,
  destLat = 41.4036,
  destLng = 2.1744
): MatchedLineETA[] {
  const results: MatchedLineETA[] = [];

  for (const line of matchedLines) {
    const isMetro =
      line.transportType === 'metro' ||
      line.code.startsWith('L') ||
      line.code === 'FM' ||
      line.name.toLowerCase().includes('metro');

    // 1. Identify closest boarding stop in origin (favoring outbound_origin or both)
    const originStopsForLine = stopsWithinOrigin.filter(
      (s) => s.lines.includes(line.code) || (line.stops && line.stops.includes(s.id))
    );

    let primaryOriginStop: BusStop | null = null;
    let minWalkOrigin = Infinity;

    for (const s of originStopsForLine) {
      const d = getDistanceMeters(originLat, originLng, s.lat, s.lng);
      const role = stopRoles.get(s.id);
      const score = (role === 'outbound_origin' || role === 'both') ? d : d + 150;
      if (score < minWalkOrigin) {
        minWalkOrigin = score;
        primaryOriginStop = s;
      }
    }

    if (!primaryOriginStop) primaryOriginStop = originStopsForLine[0];

    // 2. Identify closest arrival stop in destination (favoring outbound_dest or both)
    const destStopsForLine = stopsWithinDest.filter(
      (s) => s.lines.includes(line.code) || (line.stops && line.stops.includes(s.id))
    );

    let primaryDestStop: BusStop | null = null;
    let minWalkDest = Infinity;

    for (const s of destStopsForLine) {
      const d = getDistanceMeters(destLat, destLng, s.lat, s.lng);
      const role = stopRoles.get(s.id);
      const score = (role === 'outbound_dest' || role === 'both') ? d : d + 150;
      if (score < minWalkDest) {
        minWalkDest = score;
        primaryDestStop = s;
      }
    }

    if (!primaryDestStop) primaryDestStop = destStopsForLine[0];

    const originStopName = primaryOriginStop?.name || 'Parada Origen';
    const destStopName = primaryDestStop?.name || 'Parada Destino';
    const originStopId = primaryOriginStop?.id || '';
    const destStopId = primaryDestStop?.id || '';

    // 3. Live buses on this line
    const lineBuses = buses.filter((b) => b.lineCode.toUpperCase() === line.code.toUpperCase());

    let nextArrivalMinutes = isMetro ? 2 : 5;
    let subsequentArrivalMinutes = isMetro ? 5 : 12;

    if (primaryOriginStop && lineBuses.length > 0) {
      const etaList: number[] = [];

      for (const bus of lineBuses) {
        const dist = getDistanceMeters(bus.lat, bus.lng, primaryOriginStop.lat, primaryOriginStop.lng);
        const speedMps = Math.max(4.5, (bus.speedKmh || 22) / 3.6);
        const seconds = Math.round(dist / speedMps);
        const minutes = Math.max(1, Math.round(seconds / 60));
        etaList.push(minutes);
      }

      etaList.sort((a, b) => a - b);
      if (etaList.length > 0) {
        nextArrivalMinutes = etaList[0];
        subsequentArrivalMinutes = etaList[1] || nextArrivalMinutes + (line.frequencyMinutes || 7);
      }
    } else if (line.frequencyMinutes) {
      nextArrivalMinutes = Math.max(1, Math.round(line.frequencyMinutes / 2));
      subsequentArrivalMinutes = nextArrivalMinutes + line.frequencyMinutes;
    }

    // 4. Calculate Door-to-Door travel time breakdown
    // a. Walk to origin stop (~80 m/min at standard city walk 4.8 km/h)
    const walkToOriginDist = primaryOriginStop
      ? getDistanceMeters(originLat, originLng, primaryOriginStop.lat, primaryOriginStop.lng)
      : 150;
    const walkToOriginMinutes = Math.max(1, Math.round(walkToOriginDist / 80));

    // b. Wait time for vehicle arrival
    const waitTimeMinutes = nextArrivalMinutes;

    // c. In-transit vehicle time between origin and destination stops
    const transitDist = (primaryOriginStop && primaryDestStop)
      ? getDistanceMeters(primaryOriginStop.lat, primaryOriginStop.lng, primaryDestStop.lat, primaryDestStop.lng)
      : 1200;
    const transitSpeedMpm = isMetro ? 480 : 300; // ~29 km/h for metro, ~18 km/h for bus in city
    const transitTimeMinutes = Math.max(2, Math.round(transitDist / transitSpeedMpm));

    // d. Walk from destination stop to target destination point
    const walkFromDestDist = primaryDestStop
      ? getDistanceMeters(primaryDestStop.lat, primaryDestStop.lng, destLat, destLng)
      : 150;
    const walkFromDestMinutes = Math.max(1, Math.round(walkFromDestDist / 80));

    // Total Door-to-Door Journey Time
    const totalTravelMinutes = walkToOriginMinutes + waitTimeMinutes + transitTimeMinutes + walkFromDestMinutes;

    results.push({
      lineCode: line.code,
      lineName: line.name,
      color: line.color,
      textColor: line.textColor || '#ffffff',
      transportType: isMetro ? 'metro' : 'bus',
      originStopId,
      originStopName,
      destStopId,
      destStopName,
      nextArrivalMinutes,
      subsequentArrivalMinutes,
      direction: 'outbound',
      liveVehicleCount: lineBuses.length,
      walkToOriginMinutes,
      waitTimeMinutes,
      transitTimeMinutes,
      walkFromDestMinutes,
      totalTravelMinutes,
    });
  }

  // Requirement 4: Sort lines by total door-to-door arrival time to destination (fastest total journey first)
  return results.sort((a, b) => a.totalTravelMinutes - b.totalTravelMinutes);
}

/**
 * Requirement 6:
 * In match mode, when a line has multiple stops in the zone,
 * retains ONLY the closest stop for IDA and the closest stop for VUELTA per line,
 * avoiding visual clutter from redundant consecutive stops.
 */
export function filterClosestStopsForMatchedLines(
  stops: BusStop[],
  matchedLines: BusLine[],
  stopRoles: Map<string, MatchStopRole>,
  originLat: number,
  originLng: number,
  destLat?: number,
  destLng?: number
): Set<string> {
  const allowedStopIds = new Set<string>();
  if (matchedLines.length === 0) return allowedStopIds;

  for (const line of matchedLines) {
    const lineStops = stops.filter(
      (s) => s.lines.includes(line.code) || (line.stops && line.stops.includes(s.id))
    );

    let bestOutboundOrigin: BusStop | null = null;
    let minDistOutboundOrigin = Infinity;

    let bestReturnOrigin: BusStop | null = null;
    let minDistReturnOrigin = Infinity;

    let bestOutboundDest: BusStop | null = null;
    let minDistOutboundDest = Infinity;

    let bestReturnDest: BusStop | null = null;
    let minDistReturnDest = Infinity;

    for (const s of lineStops) {
      const role = stopRoles.get(s.id);
      if (!role) continue;

      const distOrigin = getDistanceMeters(originLat, originLng, s.lat, s.lng);
      const distDest = (destLat !== undefined && destLng !== undefined)
        ? getDistanceMeters(destLat, destLng, s.lat, s.lng)
        : Infinity;

      // IDA Origin (subida)
      if ((role === 'outbound_origin' || role === 'both') && distOrigin < minDistOutboundOrigin) {
        minDistOutboundOrigin = distOrigin;
        bestOutboundOrigin = s;
      }

      // VUELTA Origin (llegada)
      if ((role === 'return_origin' || role === 'both') && distOrigin < minDistReturnOrigin) {
        minDistReturnOrigin = distOrigin;
        bestReturnOrigin = s;
      }

      // IDA Dest (llegada)
      if ((role === 'outbound_dest' || role === 'both') && distDest < minDistOutboundDest) {
        minDistOutboundDest = distDest;
        bestOutboundDest = s;
      }

      // VUELTA Dest (subida)
      if ((role === 'return_dest' || role === 'both') && distDest < minDistReturnDest) {
        minDistReturnDest = distDest;
        bestReturnDest = s;
      }
    }

    if (bestOutboundOrigin) allowedStopIds.add(bestOutboundOrigin.id);
    if (bestReturnOrigin) allowedStopIds.add(bestReturnOrigin.id);
    if (bestOutboundDest) allowedStopIds.add(bestOutboundDest.id);
    if (bestReturnDest) allowedStopIds.add(bestReturnDest.id);
  }

  return allowedStopIds;
}

/**
 * Computes realistic transit transfer suggestions when there is NO direct match
 *
 * Suggests:
 * - Line 1 (origin) -> Transfer Station / Stop -> Line 2 (destination)
 * - Estimated total travel time
 */
export function computeTransferSuggestions(
  network: { lines: BusLine[]; stops: BusStop[] },
  stopsWithinOrigin: BusStop[],
  stopsWithinDest: BusStop[],
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): TransitTransferSuggestion[] {
  const suggestions: TransitTransferSuggestion[] = [];

  if (stopsWithinOrigin.length === 0 || stopsWithinDest.length === 0) {
    return suggestions;
  }

  // Collect distinct lines at origin and destination
  const originLineCodes = new Set<string>();
  stopsWithinOrigin.forEach((s) => s.lines.forEach((l) => originLineCodes.add(l.toUpperCase())));

  const destLineCodes = new Set<string>();
  stopsWithinDest.forEach((s) => s.lines.forEach((l) => destLineCodes.add(l.toUpperCase())));

  const originLines = network.lines.filter((l) => originLineCodes.has(l.code.toUpperCase()));
  const destLines = network.lines.filter((l) => destLineCodes.has(l.code.toUpperCase()));

  const stopMap = new Map<string, BusStop>(network.stops.map((s) => [s.id, s]));
  const codeToStopMap = new Map<string, BusStop>(network.stops.map((s) => [s.code, s]));

  // Track added transfer combinations to keep suggestions diverse
  const seenCombos = new Set<string>();

  for (const line1 of originLines) {
    for (const line2 of destLines) {
      if (line1.code === line2.code) continue; // Direct lines handled separately

      const comboKey = `${line1.code}->${line2.code}`;
      if (seenCombos.has(comboKey)) continue;

      // Find common stops or stations shared by line1 and line2
      const candidateTransferStops: { stop1: BusStop; stop2: BusStop; walkDist: number }[] = [];

      // 1. Direct same-stop interchange
      for (const stop of network.stops) {
        const servesLine1 = stop.lines.includes(line1.code) || (line1.stops && line1.stops.includes(stop.id));
        const servesLine2 = stop.lines.includes(line2.code) || (line2.stops && line2.stops.includes(stop.id));

        if (servesLine1 && servesLine2) {
          candidateTransferStops.push({ stop1: stop, stop2: stop, walkDist: 0 });
        }
      }

      // 2. If no direct shared stop, check stops within 250m walking transfer
      if (candidateTransferStops.length === 0) {
        const line1Stops = (line1.stops || [])
          .map((id) => stopMap.get(id) || codeToStopMap.get(id))
          .filter((s): s is BusStop => Boolean(s));

        const line2Stops = (line2.stops || [])
          .map((id) => stopMap.get(id) || codeToStopMap.get(id))
          .filter((s): s is BusStop => Boolean(s));

        for (const s1 of line1Stops) {
          for (const s2 of line2Stops) {
            const dist = getDistanceMeters(s1.lat, s1.lng, s2.lat, s2.lng);
            if (dist <= 250) {
              candidateTransferStops.push({ stop1: s1, stop2: s2, walkDist: dist });
              if (candidateTransferStops.length >= 3) break;
            }
          }
          if (candidateTransferStops.length >= 3) break;
        }
      }

      if (candidateTransferStops.length === 0) continue;

      // Pick the best transfer stop (closest to geographic midpoint between origin and destination)
      const midLat = (originLat + destLat) / 2;
      const midLng = (originLng + destLng) / 2;

      let bestTransfer = candidateTransferStops[0];
      let bestMidDist = Infinity;

      for (const t of candidateTransferStops) {
        const d = getDistanceMeters(midLat, midLng, t.stop1.lat, t.stop1.lng);
        if (d < bestMidDist) {
          bestMidDist = d;
          bestTransfer = t;
        }
      }

      // Best origin stop for line 1
      const firstStop =
        stopsWithinOrigin.find((s) => s.lines.includes(line1.code)) || stopsWithinOrigin[0];

      // Best destination stop for line 2
      const destStop =
        stopsWithinDest.find((s) => s.lines.includes(line2.code)) || stopsWithinDest[0];

      if (!firstStop || !destStop) continue;

      // Calculate approximate travel time
      // Leg 1: origin to transfer
      const dist1 = getDistanceMeters(firstStop.lat, firstStop.lng, bestTransfer.stop1.lat, bestTransfer.stop1.lng);
      const isL1Metro = line1.code.startsWith('L') || line1.name.toLowerCase().includes('metro');
      const time1 = Math.round(dist1 / (isL1Metro ? 500 : 320)) + (line1.frequencyMinutes ? Math.round(line1.frequencyMinutes / 2) : 3);

      // Transfer wait & walk
      const transferWait = Math.round(bestTransfer.walkDist / 70) + (line2.frequencyMinutes ? Math.round(line2.frequencyMinutes / 2) : 4);

      // Leg 2: transfer to destination
      const dist2 = getDistanceMeters(bestTransfer.stop2.lat, bestTransfer.stop2.lng, destStop.lat, destStop.lng);
      const isL2Metro = line2.code.startsWith('L') || line2.name.toLowerCase().includes('metro');
      const time2 = Math.round(dist2 / (isL2Metro ? 500 : 320));

      const totalMinutes = Math.max(10, Math.min(65, time1 + transferWait + time2));

      // Clean transfer station name
      let transferName = bestTransfer.stop1.name;
      if (bestTransfer.walkDist > 0 && bestTransfer.stop1.name !== bestTransfer.stop2.name) {
        transferName = `${bestTransfer.stop1.name} ➔ ${bestTransfer.stop2.name}`;
      }

      suggestions.push({
        id: `transfer-${line1.code}-${line2.code}-${bestTransfer.stop1.id}`,
        firstLine: line1,
        firstStop,
        transferStationName: transferName,
        transferStopFirst: bestTransfer.stop1,
        transferStopSecond: bestTransfer.stop2,
        secondLine: line2,
        destStop,
        estimatedMinutes: totalMinutes,
        walkTransferMeters: bestTransfer.walkDist,
      });

      seenCombos.add(comboKey);
      if (suggestions.length >= 6) break;
    }
    if (suggestions.length >= 6) break;
  }

  // Sort suggestions by fastest travel time
  return suggestions.sort((a, b) => a.estimatedMinutes - b.estimatedMinutes).slice(0, 4);
}
