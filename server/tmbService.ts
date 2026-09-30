import dotenv from 'dotenv';
import { BusLine, BusStop, Arrival } from '../src/types/transit';
import { BARCELONA_LINES, BARCELONA_STOPS } from '../src/data/barcelonaTransit';

dotenv.config();

export interface TmbStatus {
  configured: boolean;
  verified: boolean;
  appIdProvided: boolean;
  providerName: string;
  portalUrl: string;
  statusNote: string;
  linesCount: number;
  stopsCount: number;
  lastUpdated: string | null;
  isLoading: boolean;
}

class TmbService {
  private cachedLines: BusLine[] = [];
  private cachedStops: BusStop[] = [];
  private stopsMap: Map<string, BusStop> = new Map();
  private linesMap: Map<string, BusLine> = new Map();
  private lastFetchTime: number = 0;
  private isFetching: boolean = false;
  private fetchPromise: Promise<void> | null = null;
  private tmbVerified: boolean = false;
  private verificationMessage: string = '';

  constructor() {
    // Populate with fallback initial data so endpoints work immediately on cold start
    this.setInitialData(BARCELONA_LINES, BARCELONA_STOPS);
  }

  private setInitialData(lines: BusLine[], stops: BusStop[]) {
    this.cachedLines = lines;
    this.cachedStops = stops;
    this.linesMap.clear();
    this.stopsMap.clear();
    for (const l of lines) this.linesMap.set(l.code.toUpperCase(), l);
    for (const s of stops) {
      this.stopsMap.set(s.code, s);
      this.stopsMap.set(s.id, s);
    }
  }

  public getAppCredentials(): { appId: string | undefined; appKey: string | undefined } {
    return {
      appId: process.env.TMB_APP_ID?.trim(),
      appKey: process.env.TMB_APP_KEY?.trim(),
    };
  }

  /**
   * Loads full transit network directly from official TMB API
   */
  public async loadFullNetwork(force = false): Promise<void> {
    const { appId, appKey } = this.getAppCredentials();
    if (!appId || !appKey) {
      this.verificationMessage = 'Claves TMB_APP_ID o TMB_APP_KEY no configuradas en .env';
      return;
    }

    const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour
    const now = Date.now();
    if (!force && this.cachedLines.length > 20 && now - this.lastFetchTime < CACHE_TTL_MS) {
      return;
    }

    if (this.isFetching && this.fetchPromise) {
      return this.fetchPromise;
    }

    this.isFetching = true;
    this.fetchPromise = (async () => {
      try {
        console.log('[TMB Service] Solicitando líneas y paradas oficiales en tiempo real a TMB...');

        // 1. Fetch bus lines, metro lines, and all active stops in parallel
        const [busLinesRes, metroLinesRes, stopsRes] = await Promise.all([
          fetch(`https://api.tmb.cat/v1/transit/linies/bus?app_id=${encodeURIComponent(appId)}&app_key=${encodeURIComponent(appKey)}`, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(10000),
          }),
          fetch(`https://api.tmb.cat/v1/transit/linies/metro?app_id=${encodeURIComponent(appId)}&app_key=${encodeURIComponent(appKey)}`, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(10000),
          }),
          fetch(`https://api.tmb.cat/v1/transit/parades?app_id=${encodeURIComponent(appId)}&app_key=${encodeURIComponent(appKey)}`, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(12000),
          }),
        ]);

        if (!busLinesRes.ok || !stopsRes.ok) {
          throw new Error(`TMB responded with status busLines: ${busLinesRes.status}, stops: ${stopsRes.status}`);
        }

        const [busData, metroData, stopsData] = await Promise.all([
          busLinesRes.json(),
          metroLinesRes.ok ? metroLinesRes.json() : { features: [] },
          stopsRes.json(),
        ]);

        const rawBusFeatures = busData.features || [];
        const rawMetroFeatures = metroData.features || [];
        const rawStopFeatures = stopsData.features || [];

        console.log(`[TMB Service] Recibidas ${rawBusFeatures.length} líneas de bus, ${rawMetroFeatures.length} líneas de metro y ${rawStopFeatures.length} paradas activas.`);

        // 2. Transform lines
        const parsedLines: BusLine[] = [];
        const allLineFeatures = [...rawBusFeatures, ...rawMetroFeatures];

        for (const feat of allLineFeatures) {
          const p = feat.properties;
          const geom = feat.geometry;
          const path: [number, number][] = [];

          if (geom?.type === 'MultiLineString' && Array.isArray(geom.coordinates)) {
            const validSegments = geom.coordinates.filter(
              (seg: any) => Array.isArray(seg) && seg.length >= 2
            );

            if (validSegments.length === 1) {
              for (const coord of validSegments[0]) {
                if (Array.isArray(coord) && coord.length >= 2) {
                  path.push([coord[1], coord[0]]);
                }
              }
            } else if (validSegments.length > 1) {
              // Pick the longest continuous route segment to avoid diagonal cross-city jumps
              let bestSegment = validSegments[0];
              for (const seg of validSegments) {
                if (seg.length > bestSegment.length) {
                  bestSegment = seg;
                }
              }
              for (const coord of bestSegment) {
                if (Array.isArray(coord) && coord.length >= 2) {
                  path.push([coord[1], coord[0]]);
                }
              }
            }
          } else if (geom?.type === 'LineString' && Array.isArray(geom.coordinates)) {
            for (const coord of geom.coordinates) {
              if (Array.isArray(coord) && coord.length >= 2) {
                path.push([coord[1], coord[0]]);
              }
            }
          }

          const lineCode = String(p.NOM_LINIA || p.CODI_LINIA);
          const isMetro = p.NOM_TIPUS_TRANSPORT === 'METRO' || String(p.NOM_LINIA).startsWith('L') || p.NOM_LINIA === 'FM';

          parsedLines.push({
            id: `line-${lineCode}`,
            code: lineCode,
            name: `${lineCode} - ${p.DESC_LINIA || lineCode}`,
            color: p.COLOR_LINIA ? `#${p.COLOR_LINIA}` : (isMetro ? '#0284c7' : '#dc2626'),
            textColor: p.COLOR_TEXT_LINIA ? `#${p.COLOR_TEXT_LINIA}` : '#ffffff',
            origin: p.ORIGEN_LINIA || p.DESC_LINIA?.split('/')[0]?.trim() || 'Barcelona',
            destination: p.DESTI_LINIA || p.DESC_LINIA?.split('/')[1]?.trim() || 'Barcelona',
            frequencyMinutes: isMetro ? 3 : 7,
            stops: [],
            path,
            transportType: isMetro ? 'metro' : 'bus',
          });
        }

        // 3. Transform stops
        const parsedStops: BusStop[] = [];
        const stopCodeToStop = new Map<string, BusStop>();

        for (const feat of rawStopFeatures) {
          const p = feat.properties;
          const coords = feat.geometry?.coordinates || [2.1699, 41.3879];
          const code = String(p.CODI_PARADA);
          const shelter = Boolean(
            p.NOM_TIPUS_SIMPLE_PARADA &&
            p.NOM_TIPUS_SIMPLE_PARADA.toLowerCase().includes('marquesina')
          );

          const stopObj: BusStop = {
            id: `stop-${code}`,
            code,
            name: p.NOM_PARADA || `Parada ${code}`,
            lat: coords[1],
            lng: coords[0],
            address: p.ADRECA || p.NOM_VIA || '',
            lines: [],
            wheelchairAccessible: true,
            shelter,
            nextArrivals: [],
            transportType: 'bus',
          };

          parsedStops.push(stopObj);
          stopCodeToStop.set(code, stopObj);
        }

        // 4. Map line-stop associations in parallel batches
        console.log('[TMB Service] Asociando paradas a líneas con TMB linies/bus/{id}/parades y metro/{id}/estacions...');
        const stopToLines = new Map<string, Set<string>>();
        const lineToStops = new Map<string, string[]>();

        const BATCH_SIZE = 14;
        for (let i = 0; i < rawBusFeatures.length; i += BATCH_SIZE) {
          const chunk = rawBusFeatures.slice(i, i + BATCH_SIZE);
          await Promise.all(
            chunk.map(async (lFeat: any) => {
              const codiLinia = lFeat.properties.CODI_LINIA;
              const nomLinia = String(lFeat.properties.NOM_LINIA);
              try {
                const r = await fetch(
                  `https://api.tmb.cat/v1/transit/linies/bus/${codiLinia}/parades?app_id=${encodeURIComponent(appId)}&app_key=${encodeURIComponent(appKey)}`,
                  {
                    headers: { Accept: 'application/json' },
                    signal: AbortSignal.timeout(6000),
                  }
                );
                if (!r.ok) return;
                const d = await r.json();
                if (d?.features) {
                  const sIds: string[] = [];
                  for (const pf of d.features) {
                    const sc = String(pf.properties.CODI_PARADA);
                    sIds.push(`stop-${sc}`);
                    if (!stopToLines.has(sc)) stopToLines.set(sc, new Set());
                    stopToLines.get(sc)!.add(nomLinia);
                  }
                  lineToStops.set(nomLinia, sIds);
                }
              } catch {
                // Ignore transient errors for single line
              }
            })
          );
        }

        // 4b. Map Metro stations for all metro lines
        const metroStationCodeToStop = new Map<string, BusStop>();
        await Promise.all(
          rawMetroFeatures.map(async (mFeat: any) => {
            const codiLinia = mFeat.properties.CODI_LINIA;
            const nomLinia = String(mFeat.properties.NOM_LINIA);
            try {
              const r = await fetch(
                `https://api.tmb.cat/v1/transit/linies/metro/${codiLinia}/estacions?app_id=${encodeURIComponent(appId)}&app_key=${encodeURIComponent(appKey)}`,
                {
                  headers: { Accept: 'application/json' },
                  signal: AbortSignal.timeout(7000),
                }
              );
              if (!r.ok) return;
              const d = await r.json();
              if (d?.features) {
                const sIds: string[] = [];
                for (const ef of d.features) {
                  const ep = ef.properties;
                  const codiEstacio = String(ep.CODI_ESTACIO || ep.ID_ESTACIO);
                  const stopId = `metro-${codiEstacio}`;
                  sIds.push(stopId);

                  let existingStation = metroStationCodeToStop.get(codiEstacio);
                  if (!existingStation) {
                    const coords = ef.geometry?.coordinates || [2.1699, 41.3879];
                    existingStation = {
                      id: stopId,
                      code: `M${codiEstacio}`,
                      name: ep.NOM_ESTACIO ? `Metro ${ep.NOM_ESTACIO}` : `Estación Metro ${codiEstacio}`,
                      lat: coords[1],
                      lng: coords[0],
                      address: `Red de Metro TMB (${nomLinia})`,
                      lines: [nomLinia],
                      wheelchairAccessible: ep.NOM_TIPUS_ACCESSIBILITAT === 'Accessible' || true,
                      shelter: true,
                      nextArrivals: [],
                      transportType: 'metro',
                    };
                    metroStationCodeToStop.set(codiEstacio, existingStation);
                    parsedStops.push(existingStation);
                  } else {
                    if (!existingStation.lines.includes(nomLinia)) {
                      existingStation.lines.push(nomLinia);
                      existingStation.lines.sort();
                    }
                  }
                }
                lineToStops.set(nomLinia, sIds);
              }
            } catch {
              // Ignore single metro line timeout
            }
          })
        );

        // 5. Apply mapped lines to stops and stops to lines
        for (const stop of parsedStops) {
          const linesSet = stopToLines.get(stop.code);
          if (linesSet && linesSet.size > 0) {
            stop.lines = Array.from(linesSet).sort();
          }
        }

        for (const line of parsedLines) {
          const stopsList = lineToStops.get(line.code);
          if (stopsList && stopsList.length > 0) {
            line.stops = stopsList;
          }
        }

        // Save into cache
        this.cachedLines = parsedLines;
        this.cachedStops = parsedStops;
        this.linesMap.clear();
        this.stopsMap.clear();
        for (const l of parsedLines) this.linesMap.set(l.code.toUpperCase(), l);
        for (const s of parsedStops) {
          this.stopsMap.set(s.code, s);
          this.stopsMap.set(s.id, s);
        }

        this.lastFetchTime = Date.now();
        this.tmbVerified = true;
        this.verificationMessage = `Conexión en vivo con TMB verificada: ${parsedLines.length} líneas y ${parsedStops.length} paradas en tiempo real.`;
        console.log(`[TMB Service] ✅ Proceso completado con éxito: ${parsedLines.length} líneas y ${parsedStops.length} paradas oficiales cargadas.`);
      } catch (err: any) {
        console.error('[TMB Service] Error cargando datos de TMB:', err?.message || err);
        this.verificationMessage = `Error de conexión con TMB: ${err?.message || 'Fallo de red'}`;
      } finally {
        this.isFetching = false;
        this.fetchPromise = null;
      }
    })();

    return this.fetchPromise;
  }

  public getLines(): BusLine[] {
    return this.cachedLines;
  }

  public getStops(options?: { lat?: number; lng?: number; radiusMeters?: number }): BusStop[] {
    if (!options?.lat || !options?.lng || !options?.radiusMeters) {
      return this.cachedStops;
    }

    const { lat, lng, radiusMeters } = options;
    const degLat = radiusMeters / 111000;
    const degLng = radiusMeters / (111000 * Math.cos((lat * Math.PI) / 180));

    return this.cachedStops.filter((s) => {
      return (
        Math.abs(s.lat - lat) <= degLat &&
        Math.abs(s.lng - lng) <= degLng
      );
    });
  }

  public getStopByCode(codeOrId: string): BusStop | undefined {
    const cleanDigits = codeOrId.replace(/^[^\d]+/, '').replace(/^0+/, '');
    return (
      this.stopsMap.get(codeOrId) ||
      this.stopsMap.get(cleanDigits) ||
      this.stopsMap.get(`stop-${cleanDigits}`) ||
      this.stopsMap.get(cleanDigits.padStart(4, '0'))
    );
  }

  public getLineByCode(code: string): BusLine | undefined {
    return this.linesMap.get(code.toUpperCase());
  }

  /**
   * Fetches real-time GPS arrivals from TMB iBus for a given stop
   */
  public async getRealtimeArrivals(stopCode: string): Promise<{
    success: boolean;
    isLive: boolean;
    provider: string;
    stopCode: string;
    arrivals: Arrival[];
    message?: string;
    requiresCredentials?: boolean;
    invalidCredentials?: boolean;
  }> {
    const rawDigits = stopCode.replace(/^[^\d]+/, '');
    const cleanNumericCode = rawDigits.replace(/^0+/, '') || rawDigits || '1';

    const { appId, appKey } = this.getAppCredentials();
    if (!appId || !appKey) {
      return {
        success: true,
        isLive: false,
        provider: 'TMB Barcelona Oficial',
        stopCode: cleanNumericCode,
        arrivals: [],
        requiresCredentials: true,
        message: 'Para consultar llegadas en vivo por GPS, añade TMB_APP_ID y TMB_APP_KEY en el archivo .env.',
      };
    }

    const stop = this.getStopByCode(cleanNumericCode);

    try {
      const url = `https://api.tmb.cat/v1/ibus/stops/${encodeURIComponent(cleanNumericCode)}?app_id=${encodeURIComponent(appId)}&app_key=${encodeURIComponent(appKey)}`;
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(6000),
      });

      if (response.ok) {
        const data = await response.json();
        const rawItems = data?.data?.ibus || data?.ibus || [];

        if (Array.isArray(rawItems) && rawItems.length > 0) {
          const arrivals: Arrival[] = rawItems.map((item: any, idx: number) => {
            const lineCode = String(item.line || item['line-id'] || item.routeId || 'BUS');
            const lineInfo = this.getLineByCode(lineCode);
            const mins = Number(item['t-in-min'] ?? Math.max(0, Math.round((item['t-in-s'] || 120) / 60)));
            const secs = Number(item['t-in-s'] ?? mins * 60);

            return {
              id: `tmb-live-${cleanNumericCode}-${lineCode}-${idx}`,
              lineId: lineInfo?.id || `line-${lineCode}`,
              lineCode,
              destination: item.destination || lineInfo?.destination || 'Destí TMB',
              etaSeconds: secs,
              distanceMeters: Math.max(80, mins * 350),
              busPlate: item.plate || `TMB-${lineCode}-${1000 + idx * 43}`,
              occupancy: (item.occupancy || 'medium') as 'low' | 'medium' | 'high',
              isAccessible: true,
              busLocation: [
                (stop?.lat || 41.3879),
                (stop?.lng || 2.1699),
              ] as [number, number],
              speedKmh: 24,
              lineColor: lineInfo?.color || '#2563eb',
              lineTextColor: lineInfo?.textColor || '#ffffff',
            };
          });

          return {
            success: true,
            isLive: true,
            provider: 'TMB iBus Oficial (GPS en directo)',
            stopCode: cleanNumericCode,
            arrivals: arrivals.sort((a, b) => a.etaSeconds - b.etaSeconds),
          };
        }

        return {
          success: true,
          isLive: true,
          provider: 'TMB iBus Oficial',
          stopCode: cleanNumericCode,
          arrivals: [],
          message: 'No hay autobuses en aproximación inmediata en los próximos 30 minutos según TMB iBus.',
        };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          isLive: false,
          provider: 'TMB iBus Oficial',
          stopCode: cleanNumericCode,
          arrivals: [],
          invalidCredentials: true,
          message: 'Error de autenticación con TMB (HTTP 401/403). Comprueba que TMB_APP_ID y TMB_APP_KEY sean correctos.',
        };
      }
    } catch (err: any) {
      console.warn('[TMB Service] Error en consulta iBus:', err?.message || err);
    }

    return {
      success: true,
      isLive: false,
      provider: 'TMB Barcelona Oficial',
      stopCode: cleanNumericCode,
      arrivals: [],
      message: 'No se pudo conectar temporalmente con el servicio iBus de TMB.',
    };
  }

  public getStatus(): TmbStatus {
    const { appId, appKey } = this.getAppCredentials();
    return {
      configured: Boolean(appId && appKey),
      verified: this.tmbVerified,
      appIdProvided: Boolean(appId),
      providerName: 'Transports Metropolitans de Barcelona (TMB iBus Oficial)',
      portalUrl: 'https://developer.tmb.cat/',
      statusNote: this.verificationMessage || (appId && appKey ? 'Conexión activa con TMB.' : 'Claves no configuradas.'),
      linesCount: this.cachedLines.length,
      stopsCount: this.cachedStops.length,
      lastUpdated: this.lastFetchTime ? new Date(this.lastFetchTime).toISOString() : null,
      isLoading: this.isFetching,
    };
  }
}

export const tmbService = new TmbService();
