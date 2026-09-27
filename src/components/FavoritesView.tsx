import React from 'react';
import { FavoriteItem, BusStop, BusLine } from '../types/transit';
import { formatDistance, formatETA } from '../utils/geo';
import { Star, Trash2, MapPin, Bus, ArrowRight, Clock, ShieldCheck } from 'lucide-react';

interface FavoritesViewProps {
  favorites: FavoriteItem[];
  stops: BusStop[];
  lines: BusLine[];
  userLat?: number;
  userLng?: number;
  onSelectStop: (stop: BusStop) => void;
  onSelectLine: (line: BusLine) => void;
  onRemoveFavorite: (id: string) => void;
  onAddStopFavorite: (stop: BusStop) => void;
  isOffline: boolean;
}

export const FavoritesView: React.FC<FavoritesViewProps> = ({
  favorites,
  stops,
  lines,
  userLat,
  userLng,
  onSelectStop,
  onSelectLine,
  onRemoveFavorite,
  onAddStopFavorite,
  isOffline,
}) => {
  return (
    <div id="favorites-view" className="h-full overflow-y-auto px-4 py-4 pb-24 space-y-4">
      {/* Header info */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
            Mis Rutas y Paradas Favoritas
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Consulta rápida de tiempos y estado en tiempo real (disponible offline)
          </p>
        </div>
        {isOffline && (
          <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
            Offline
          </span>
        )}
      </div>

      {favorites.length === 0 ? (
        <div className="p-6 rounded-3xl bg-slate-800/60 border border-slate-700/60 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Star className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">No tienes favoritos guardados aún</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Guarda las paradas que frecuentas para consultar cuánto falta para que pase tu autobús con un solo toque, incluso sin conexión.
            </p>
          </div>

          {/* Quick recommendations from nearby stops */}
          {stops.length > 0 && (
            <div className="pt-2 text-left">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                Sugerencias cercanas para añadir:
              </span>
              <div className="space-y-2">
                {stops.slice(0, 3).map((stop) => (
                  <div
                    key={stop.id}
                    className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/70 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-semibold text-white">{stop.name}</div>
                      <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <span className="text-amber-400 font-bold">#{stop.code}</span>
                        <span>•</span>
                        <span>Líneas: {stop.lines.join(', ')}</span>
                      </div>
                    </div>
                    <button
                      id={`btn-add-fav-suggest-${stop.id}`}
                      onClick={() => onAddStopFavorite(stop)}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 transition-all active:scale-95"
                    >
                      <Star className="w-3.5 h-3.5 fill-slate-950" />
                      Añadir
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {favorites.map((fav) => {
            if (fav.type === 'stop') {
              const stop = stops.find((s) => s.id === fav.stopId || s.code === fav.stopCode);
              const nextBus = stop?.nextArrivals[0];
              const eta = nextBus ? formatETA(nextBus.etaSeconds) : null;

              return (
                <div
                  key={fav.id}
                  id={`favorite-card-${fav.id}`}
                  className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/70 hover:border-slate-600 transition-all shadow-lg flex flex-col gap-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-xs">
                        <Bus className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          <span>{fav.stopName}</span>
                          <span className="text-xs text-amber-400 font-medium">#{fav.stopCode}</span>
                        </div>
                        {stop && (
                          <div className="text-xs text-slate-400">
                            Líneas disponibles: {stop.lines.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      id={`btn-remove-fav-${fav.id}`}
                      onClick={() => onRemoveFavorite(fav.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Eliminar de favoritos"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Real-time next bus arrival pill */}
                  {nextBus && eta ? (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-700/60">
                      <div className="flex items-center gap-2">
                        <span
                          className="px-2 py-0.5 rounded text-xs font-extrabold text-white"
                          style={{ backgroundColor: nextBus.lineColor }}
                        >
                          {nextBus.lineCode}
                        </span>
                        <div className="text-xs text-slate-300 truncate">
                          {nextBus.destination}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${eta.badgeClass}`}>
                          {eta.text}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 bg-slate-900/60 p-2 rounded-xl">
                      Consultando tiempos próximos...
                    </div>
                  )}

                  {/* Bottom Action */}
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-slate-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Disponible offline
                    </span>

                    {stop && (
                      <button
                        id={`btn-view-stop-map-${stop.id}`}
                        onClick={() => onSelectStop(stop)}
                        className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 active:scale-95 transition-transform"
                      >
                        <span>Ver en mapa y tiempos completos</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            // Route favorite
            const line = lines.find((l) => l.code === fav.lineCode);
            return (
              <div
                key={fav.id}
                id={`favorite-card-${fav.id}`}
                className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/70 hover:border-slate-600 transition-all shadow-lg flex flex-col gap-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-white text-base shadow-sm"
                      style={{ backgroundColor: fav.lineColor || '#2563eb' }}
                    >
                      {fav.lineCode}
                    </span>
                    <div>
                      <div className="text-sm font-bold text-white">Línea {fav.lineCode}</div>
                      <div className="text-xs text-slate-400">{fav.lineName}</div>
                    </div>
                  </div>

                  <button
                    id={`btn-remove-fav-${fav.id}`}
                    onClick={() => onRemoveFavorite(fav.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Eliminar de favoritos"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {line && (
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-xs text-slate-300 flex items-center justify-between">
                    <div>
                      <span className="text-slate-400">Trayecto:</span> {line.origin} ➔ {line.destination}
                    </div>
                    <span className="text-blue-400 font-semibold whitespace-nowrap">
                      Cada {line.frequencyMinutes} min
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-slate-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Disponible offline
                  </span>

                  {line && (
                    <button
                      id={`btn-view-line-map-${line.code}`}
                      onClick={() => onSelectLine(line)}
                      className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 active:scale-95 transition-transform"
                    >
                      <span>Ver recorrido en mapa</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
