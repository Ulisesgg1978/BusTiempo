import React from 'react';
import { BusStop, BusLine, Arrival, ActiveAlert } from '../types/transit';
import { formatDistance, formatETA } from '../utils/geo';
import { Star, Bell, BellOff, X, Accessibility, Umbrella, Compass, MapPin, RotateCw, Radio } from 'lucide-react';

interface StopDetailsSheetProps {
  stop: BusStop;
  lines: BusLine[];
  userDistanceMeters?: number;
  isFavorite: boolean;
  activeAlerts: ActiveAlert[];
  onToggleFavorite: () => void;
  onToggleAlert: (arrival: Arrival) => void;
  onSelectLine: (line: BusLine) => void;
  onClose: () => void;
  isOffline: boolean;
  onRefreshLive?: () => void;
  isRefreshing?: boolean;
}

export const StopDetailsSheet: React.FC<StopDetailsSheetProps> = ({
  stop,
  lines,
  userDistanceMeters,
  isFavorite,
  activeAlerts,
  onToggleFavorite,
  onToggleAlert,
  onSelectLine,
  onClose,
  isOffline,
  onRefreshLive,
  isRefreshing = false,
}) => {
  return (
    <div
      id="stop-details-sheet"
      className="absolute bottom-16 md:bottom-0 left-0 right-0 max-h-[78vh] bg-slate-900/98 backdrop-blur-xl border-t border-slate-700/80 text-slate-100 shadow-2xl rounded-t-3xl z-[500] flex flex-col transition-all duration-300 animate-in slide-in-from-bottom"
    >
      {/* Drag Indicator handle */}
      <div className="flex justify-center pt-2.5 pb-1">
        <div className="w-12 h-1.5 rounded-full bg-slate-600/70" />
      </div>

      {/* Header */}
      <div className="px-5 py-3 border-b border-slate-800 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 font-bold text-xs border border-amber-500/30">
              Parada #{stop.code}
            </span>
            {userDistanceMeters !== undefined && (
              <span className="flex items-center gap-1 text-xs text-blue-400 font-medium">
                <MapPin className="w-3 h-3 inline" />
                a {formatDistance(userDistanceMeters)} de ti
              </span>
            )}
            {stop.wheelchairAccessible && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium" title="Accesible para sillas de ruedas">
                <Accessibility className="w-3 h-3" />
                PMR
              </span>
            )}
            {stop.shelter && (
              <span className="flex items-center gap-1 text-[11px] text-slate-400" title="Cuenta con marquesina">
                <Umbrella className="w-3 h-3" />
                Con marquesina
              </span>
            )}
          </div>

          <h2 className="text-lg font-bold text-white tracking-tight mt-1 truncate">
            {stop.name}
          </h2>
          <p className="text-xs text-slate-400 truncate">
            {stop.address}
          </p>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1.5">
          <button
            id="btn-toggle-favorite-stop"
            onClick={onToggleFavorite}
            className={`p-2 rounded-xl transition-all ${
              isFavorite
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700/60'
            }`}
            title={isFavorite ? 'Quitar de favoritos' : 'Guardar parada en favoritos'}
            aria-label="Favorito"
          >
            <Star className={`w-5 h-5 ${isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
          </button>

          <button
            id="btn-close-stop-sheet"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700/60 transition-colors"
            title="Cerrar panel"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Offline Alert notice */}
      {isOffline && (
        <div className="mx-5 mt-3 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <span>Modo offline: Consultando tiempos estimados guardados en caché.</span>
        </div>
      )}

      {/* Available Lines Badges */}
      <div className="px-5 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-slate-800/60">
        <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Líneas:</span>
        {stop.lines.map((lineCode) => {
          const lineObj = lines.find((l) => l.code === lineCode);
          const color = lineObj?.color || '#3b82f6';
          return (
            <button
              key={lineCode}
              id={`pill-line-${lineCode}`}
              onClick={() => lineObj && onSelectLine(lineObj)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-white transition-transform active:scale-95 shadow-sm"
              style={{ backgroundColor: color }}
              title={`Ver recorrido de la línea ${lineCode}`}
            >
              <span>{lineCode}</span>
              <Compass className="w-3 h-3 opacity-80" />
            </button>
          );
        })}
      </div>

      {/* Arrivals List */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Próximos Autobuses
            </h3>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              TMB iBus
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-blue-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              GPS en vivo
            </span>

            {onRefreshLive && (
              <button
                id="btn-refresh-stop-arrivals"
                onClick={onRefreshLive}
                disabled={isRefreshing}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-all disabled:opacity-50"
                title="Actualizar tiempos en directo de TMB"
                aria-label="Actualizar tiempos"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {stop.nextArrivals.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">
            No hay autobuses próximos programados en este momento.
          </div>
        ) : (
          stop.nextArrivals.map((arrival) => {
            const eta = formatETA(arrival.etaSeconds);
            const isAlertActive = activeAlerts.some(
              (a) => a.stopId === stop.id && a.lineCode === arrival.lineCode
            );

            return (
              <div
                key={arrival.id}
                id={`arrival-card-${arrival.id}`}
                className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/70 hover:border-slate-600 transition-all flex items-center justify-between gap-3 shadow-md"
              >
                {/* Line badge & destination */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-extrabold text-white text-base shadow-sm shrink-0"
                    style={{ backgroundColor: arrival.lineColor }}
                  >
                    {arrival.lineCode}
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate flex items-center gap-1.5">
                      <span>Destino: {arrival.destination}</span>
                    </div>

                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 flex-wrap">
                      <span>{arrival.busPlate}</span>
                      <span>•</span>
                      <span>A {formatDistance(arrival.distanceMeters)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5">
                        {arrival.occupancy === 'low' && '🟢 Poca ocupación'}
                        {arrival.occupancy === 'medium' && '🟡 Ocupación media'}
                        {arrival.occupancy === 'high' && '🔴 Alta ocupación'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Countdown & Alert Trigger */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <div
                    className={`px-3 py-1 rounded-xl text-xs font-bold shadow-sm whitespace-nowrap ${eta.badgeClass}`}
                  >
                    {eta.text}
                  </div>

                  <button
                    id={`btn-alert-${arrival.id}`}
                    onClick={() => onToggleAlert(arrival)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      isAlertActive
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30'
                        : 'bg-slate-700/70 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600/50'
                    }`}
                    title={
                      isAlertActive
                        ? 'Alarma activa: Te avisaremos cuando se aproxime'
                        : 'Avisarme cuando este autobús se aproxime a mi ubicación'
                    }
                  >
                    {isAlertActive ? (
                      <>
                        <Bell className="w-3 h-3 fill-slate-950 text-slate-950" />
                        <span>Aviso Activo</span>
                      </>
                    ) : (
                      <>
                        <BellOff className="w-3 h-3 text-slate-400" />
                        <span>Avisarme</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Proximity Alert explanation footer */}
      <div className="px-5 py-2.5 bg-slate-950/60 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
        <span>💡 Toca <strong>Avisarme</strong> para recibir notificación sonora y vibración al acercarse.</span>
      </div>
    </div>
  );
};
