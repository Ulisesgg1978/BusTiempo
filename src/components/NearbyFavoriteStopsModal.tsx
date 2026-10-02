import React, { useState, useEffect } from 'react';
import {
  Star,
  X,
  MapPin,
  Clock,
  Radio,
  Wifi,
  Bus,
  Train,
  ArrowRight,
  Navigation,
  Compass,
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { BusStop, BusLine, LiveBus, FavoriteItem, UserPosition, Arrival } from '../types/transit';
import { formatDistance, getDistanceMeters } from '../utils/geo';
import { getRealtimeStopArrivals } from '../services/transitData';
import { getLineOperatingStatus } from '../utils/operatingHours';

interface NearbyFavoriteStopsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userLocation: UserPosition | null;
  stops: BusStop[];
  lines: BusLine[];
  buses: LiveBus[];
  favorites: FavoriteItem[];
  onToggleFavorite: (stop: BusStop) => void;
  onSelectStopOnMap: (stop: BusStop) => void;
}

export const NearbyFavoriteStopsModal: React.FC<NearbyFavoriteStopsModalProps> = ({
  isOpen,
  onClose,
  userLocation,
  stops,
  lines,
  buses,
  favorites,
  onToggleFavorite,
  onSelectStopOnMap,
}) => {
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [stopArrivals, setStopArrivals] = useState<Record<string, Arrival[]>>({});
  const [isLoadingArrivals, setIsLoadingArrivals] = useState<Record<string, boolean>>({});
  const [showAllFavorites, setShowAllFavorites] = useState(false);

  // Filter favorite stops
  const favoriteStopItems = favorites.filter((f) => f.type === 'stop');
  const favoriteStopIdSet = new Set(
    favoriteStopItems.map((f) => f.stopId || f.stopCode).filter(Boolean)
  );

  const userLat = userLocation?.lat ?? 41.3879;
  const userLng = userLocation?.lng ?? 2.1699;

  // Compute all favorite stops with distance to GPS
  const favoriteStopsWithDistance = stops
    .filter((s) => favoriteStopIdSet.has(s.id) || favoriteStopIdSet.has(s.code))
    .map((s) => {
      const dist = getDistanceMeters(userLat, userLng, s.lat, s.lng);
      return { stop: s, distanceMeters: dist };
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  // Filter within 500m
  const favoriteStopsIn500m = favoriteStopsWithDistance.filter((item) => item.distanceMeters <= 500);

  // All stops in 500m (for fallback suggestion if none are favorited yet)
  const allStopsIn500m = stops
    .map((s) => ({ stop: s, distanceMeters: getDistanceMeters(userLat, userLng, s.lat, s.lng) }))
    .filter((item) => item.distanceMeters <= 500)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  const displayedList = showAllFavorites ? favoriteStopsWithDistance : favoriteStopsIn500m;

  // Load live arrival times when a stop is opened
  const loadArrivalsForStop = async (stop: BusStop) => {
    if (selectedStopId === stop.id) {
      setSelectedStopId(null);
      return;
    }

    setSelectedStopId(stop.id);
    setIsLoadingArrivals((prev) => ({ ...prev, [stop.id]: true }));

    try {
      // 1. Check live vehicles currently approaching this stop
      const approachingVehicles = buses.filter(
        (b) => b.nextStopId === stop.id || b.nextStopId === stop.code
      );

      // 2. Fetch real-time arrivals from TMB backend
      const res = await getRealtimeStopArrivals(stop.code);
      let calculatedArrivals: Arrival[] = [];

      if (res && res.arrivals && res.arrivals.length > 0) {
        calculatedArrivals = res.arrivals.map((arr) => ({
          ...arr,
          isRealTime: true,
          sourceType: 'ibus_real',
        }));
      } else {
        // Fallback: calculate using stop lines, approaching vehicles and frequencies
        calculatedArrivals = stop.lines.map((lineCode, idx) => {
          const matchedLine = lines.find((l) => l.code === lineCode);
          const liveVehicle = approachingVehicles.find((v) => v.lineCode === lineCode);
          const op = matchedLine ? getLineOperatingStatus(matchedLine) : { inService: true };

          const isReal = Boolean(liveVehicle);
          let etaSec = 0;
          if (liveVehicle) {
            const dist = getDistanceMeters(liveVehicle.lat, liveVehicle.lng, stop.lat, stop.lng);
            const speedMps = Math.max(4.5, (liveVehicle.speedKmh || 22) / 3.6);
            etaSec = Math.round(dist / speedMps);
          } else {
            const freq = matchedLine?.frequencyMinutes || 8;
            etaSec = Math.round(((idx + 1) * (freq * 60)) / 2);
          }

          return {
            id: `arr-${stop.id}-${lineCode}-${idx}`,
            lineId: matchedLine?.id || `line-${lineCode}`,
            lineCode,
            destination: matchedLine?.destination || 'Terminal',
            etaSeconds: etaSec,
            distanceMeters: liveVehicle ? Math.round(liveVehicle.distanceToNextStopMeters || 350) : 800,
            busPlate: liveVehicle?.plate || `TMB-${lineCode}-EST`,
            occupancy: liveVehicle?.occupancy || 'medium',
            isAccessible: true,
            busLocation: liveVehicle ? [liveVehicle.lat, liveVehicle.lng] : [stop.lat, stop.lng],
            speedKmh: liveVehicle?.speedKmh || 20,
            lineColor: matchedLine?.color || '#2563eb',
            lineTextColor: matchedLine?.textColor || '#ffffff',
            isRealTime: isReal,
            sourceType: isReal ? 'ibus_real' : 'frequency_estimate',
          };
        });
      }

      setStopArrivals((prev) => ({
        ...prev,
        [stop.id]: calculatedArrivals.sort((a, b) => a.etaSeconds - b.etaSeconds),
      }));
    } finally {
      setIsLoadingArrivals((prev) => ({ ...prev, [stop.id]: false }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[700] bg-slate-950 flex flex-col overflow-hidden animate-in fade-in duration-200 text-white font-sans">
      {/* Fullscreen Header */}
      <header className="px-4 py-3.5 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 flex items-center justify-between shrink-0 shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm">
            <Star className="w-5 h-5 fill-amber-400" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight flex items-center gap-2">
              <span>Paradas Favoritas Cercanas</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                Radio 500m GPS
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
              <Navigation className="w-3 h-3 text-blue-400" />
              <span>
                {userLocation ? 'Ubicación GPS activa' : 'Ubicación de referencia Barcelona'} · Pulsa una parada para ver tiempos de llegada
              </span>
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-base transition-colors shadow"
          title="Cerrar ventana"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Filter and Radius Sub-Bar */}
      <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-[11px]">
            Mostrando:{' '}
            <strong className="text-white">
              {displayedList.length} {displayedList.length === 1 ? 'parada favorita' : 'paradas favoritas'}
            </strong>
          </span>
        </div>

        {favoriteStopsWithDistance.length > favoriteStopsIn500m.length && (
          <button
            onClick={() => setShowAllFavorites(!showAllFavorites)}
            className="text-[11px] font-bold text-amber-300 hover:text-amber-200 underline flex items-center gap-1"
          >
            {showAllFavorites
              ? 'Ver solo a menos de 500m'
              : `Ver todas mis favoritas (${favoriteStopsWithDistance.length})`}
          </button>
        )}
      </div>

      {/* Main Full-Screen Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-16">
        {/* If NO favorite stops within 500m */}
        {displayedList.length === 0 ? (
          <div className="py-10 px-4 text-center max-w-md mx-auto space-y-4">
            <div className="w-14 h-14 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto text-xl">
              <Compass className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-white">
                Sin paradas favoritas a menos de 500m
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Actualmente no tienes ninguna parada guardada como favorita en un radio de 500 metros de tu ubicación GPS.
              </p>
            </div>

            {/* Quick add nearby stops as favorites */}
            {allStopsIn500m.length > 0 && (
              <div className="text-left bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
                <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5" />
                  <span>Paradas detectadas a menos de 500m (pulsa para añadir a favoritas):</span>
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {allStopsIn500m.slice(0, 6).map(({ stop, distanceMeters }) => (
                    <div
                      key={stop.id}
                      className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700/80 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{stop.name}</div>
                        <div className="text-[10px] text-slate-400">
                          #{stop.code} · {formatDistance(distanceMeters)} · Líneas: {stop.lines.join(', ')}
                        </div>
                      </div>
                      <button
                        onClick={() => onToggleFavorite(stop)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/40 shrink-0 flex items-center gap-1 active:scale-95 transition-all"
                      >
                        <Star className="w-3 h-3" />
                        <span>+ Favorita</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* List of favorite stops within 500m */
          displayedList.map(({ stop, distanceMeters }) => {
            const isExpanded = selectedStopId === stop.id;
            const arrivals = stopArrivals[stop.id] || [];
            const isLoading = isLoadingArrivals[stop.id];

            return (
              <div
                key={stop.id}
                className={`rounded-2xl border transition-all duration-200 overflow-hidden shadow-lg ${
                  isExpanded
                    ? 'bg-slate-900 border-amber-400/80 ring-2 ring-amber-400/30 shadow-amber-950/20'
                    : 'bg-slate-900/80 hover:bg-slate-900 border-slate-800'
                }`}
              >
                {/* Stop Card Header: Tapping expands arrival times */}
                <div
                  onClick={() => loadArrivalsForStop(stop)}
                  className="p-4 cursor-pointer flex items-center justify-between gap-3 select-none"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0">
                      <Star className="w-5 h-5 fill-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-white truncate">
                          {stop.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-slate-800 text-blue-400 border border-slate-700 shrink-0">
                          #{stop.code}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 truncate">
                        <span className="text-emerald-400 font-bold flex items-center gap-1 shrink-0">
                          <Navigation className="w-3 h-3" />
                          <span>a {formatDistance(distanceMeters)}</span>
                        </span>
                        <span className="truncate">· Líneas: {stop.lines.join(', ')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1 hidden sm:inline">
                      {isExpanded ? 'Ocultar llegadas' : 'Ver llegadas'}
                    </span>
                    <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Live Arrival Times for this favorite stop */}
                {isExpanded && (
                  <div className="p-4 pt-1 border-t border-slate-800 bg-slate-950/60 space-y-3">
                    <div className="flex items-center justify-between pt-1">
                      <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-blue-400" />
                        <span>Próximas llegadas en directo:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            loadArrivalsForStop(stop);
                          }}
                          className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
                          title="Actualizar tiempos"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Actualizar</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectStopOnMap(stop);
                            onClose();
                          }}
                          className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1 shadow"
                        >
                          <span>Ver en mapa</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {isLoading ? (
                      <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                        <span>Consultando telemetría TMB iBus en tiempo real...</span>
                      </div>
                    ) : arrivals.length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400">
                        No hay autobuses programados para los próximos minutos en esta parada.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {arrivals.map((arr) => {
                          const minutes = Math.max(1, Math.round(arr.etaSeconds / 60));
                          const isReal = arr.isRealTime || arr.sourceType === 'ibus_real';

                          return (
                            <div
                              key={arr.id}
                              className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3 shadow-sm"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                  className="px-2.5 py-1 rounded-lg font-black text-xs text-white shadow-sm shrink-0"
                                  style={{ backgroundColor: arr.lineColor }}
                                >
                                  {arr.lineCode}
                                </span>
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-white truncate">
                                    ➔ {arr.destination}
                                  </div>
                                  <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                    <span>Bus {arr.busPlate}</span>
                                    <span>·</span>
                                    <span>Ocupación: {arr.occupancy === 'low' ? '🟢 Baja' : arr.occupancy === 'medium' ? '🟡 Media' : '🔴 Alta'}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0 flex flex-col items-end">
                                <div className="text-sm font-black text-white flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                                  <span>{minutes} min</span>
                                </div>

                                {/* Status Icon & Badge: iBus Real vs Estimación Teórica */}
                                <div className="mt-1">
                                  {isReal ? (
                                    <span
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                                      title="Dato verificado por telemetría GPS iBus de TMB (Alta fiabilidad)"
                                    >
                                      <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                                      <span>iBus Real (TMB)</span>
                                    </span>
                                  ) : (
                                    <span
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                      title="Estimación basada en la frecuencia teórica de paso"
                                    >
                                      <Clock className="w-2.5 h-2.5 text-amber-400" />
                                      <span>Estimado (Frecuencia)</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
