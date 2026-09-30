import React, { useState } from 'react';
import { FavoriteItem, BusStop, BusLine, DestinationFavorite } from '../types/transit';
import { formatDistance, formatETA } from '../utils/geo';
import { Star, Trash2, MapPin, Bus, ArrowRight, Clock, ShieldCheck, Target, Plus, Navigation } from 'lucide-react';
import { CreateDestinationFavoriteModal } from './CreateDestinationFavoriteModal';

interface FavoritesViewProps {
  favorites: FavoriteItem[];
  stops: BusStop[];
  lines: BusLine[];
  favoriteDestinations?: DestinationFavorite[];
  userLat?: number;
  userLng?: number;
  onSelectStop: (stop: BusStop) => void;
  onSelectLine: (line: BusLine) => void;
  onSelectDestination?: (lat: number, lng: number, name?: string) => void;
  onRemoveFavorite: (id: string) => void;
  onAddStopFavorite: (stop: BusStop) => void;
  onAddDestinationFavorite?: (fav: DestinationFavorite) => void;
  onRemoveDestinationFavorite?: (id: string) => void;
  isOffline: boolean;
}

export const FavoritesView: React.FC<FavoritesViewProps> = ({
  favorites,
  stops,
  lines,
  favoriteDestinations = [],
  userLat,
  userLng,
  onSelectStop,
  onSelectLine,
  onSelectDestination,
  onRemoveFavorite,
  onAddStopFavorite,
  onAddDestinationFavorite,
  onRemoveDestinationFavorite,
  isOffline,
}) => {
  const [activeSection, setActiveSection] = useState<'stops_routes' | 'destinations'>('stops_routes');
  const [showCreateDestModal, setShowCreateDestModal] = useState(false);

  return (
    <div id="favorites-view" className="h-full overflow-y-auto px-4 py-4 pb-24 space-y-4">
      {/* Header info */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
            Mis Favoritos
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Tus paradas, líneas y destinos frecuentes siempre a mano
          </p>
        </div>
        {isOffline && (
          <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
            Offline
          </span>
        )}
      </div>

      {/* Segmented Section Switcher */}
      <div className="flex items-center p-1 rounded-2xl bg-slate-900 border border-slate-800">
        <button
          onClick={() => setActiveSection('stops_routes')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeSection === 'stops_routes'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Bus className="w-3.5 h-3.5" />
          <span>Paradas y Rutas ({favorites.length})</span>
        </button>
        <button
          onClick={() => setActiveSection('destinations')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeSection === 'destinations'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>Destinos Favoritos ({favoriteDestinations.length})</span>
        </button>
      </div>

      {/* SECTION 1: Destination Favorites */}
      {activeSection === 'destinations' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">
              Lugares habituales guardados
            </span>
            <button
              onClick={() => setShowCreateDestModal(true)}
              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-purple-600/30 transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir Destino</span>
            </button>
          </div>

          {favoriteDestinations.length === 0 ? (
            <div className="p-6 rounded-3xl bg-slate-800/60 border border-slate-700/60 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Target className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">No tienes destinos favoritos guardados</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Guarda tu casa, oficina, universidad o gimnasio para calcular rutas y matches directos en 1 segundo.
              </p>
              <button
                onClick={() => setShowCreateDestModal(true)}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md"
              >
                + Crear primer destino favorito
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {favoriteDestinations.map((fav) => {
                const dist =
                  userLat !== undefined && userLng !== undefined
                    ? formatDistance(
                        Math.hypot(
                          (userLat - fav.lat) * 111320,
                          (userLng - fav.lng) * 111320 * Math.cos((userLat * Math.PI) / 180)
                        )
                      )
                    : null;

                return (
                  <div
                    key={fav.id}
                    className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between gap-3 shadow-sm hover:border-purple-500/50 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-500/40 text-xl flex items-center justify-center shrink-0 shadow">
                        {fav.icon || '⭐'}
                      </div>
                      <div className="min-w-0">
                        <div className="font-extrabold text-white text-sm truncate">{fav.name}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span className="capitalize text-purple-300 font-semibold">{fav.category}</span>
                          {dist && (
                            <>
                              <span>•</span>
                              <span>A {dist} de ti</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {onSelectDestination && (
                        <button
                          onClick={() => onSelectDestination(fav.lat, fav.lng, fav.name)}
                          className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black flex items-center gap-1 shadow-md shadow-purple-600/30 active:scale-95 transition-all"
                          title="Fijar este destino y ver matches en el mapa"
                        >
                          <Target className="w-3.5 h-3.5" />
                          <span>Fijar ➔</span>
                        </button>
                      )}
                      {onRemoveDestinationFavorite && (
                        <button
                          onClick={() => onRemoveDestinationFavorite(fav.id)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Eliminar destino favorito"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: Stops & Routes Favorites */}
      {activeSection === 'stops_routes' && (
        favorites.length === 0 ? (
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
                const distanceMeters =
                  stop && userLat && userLng
                    ? Math.round(
                        Math.hypot(
                          (userLat - stop.lat) * 111320,
                          (userLng - stop.lng) * 111320 * Math.cos((userLat * Math.PI) / 180)
                        )
                      )
                    : undefined;

                return (
                  <div
                    key={fav.id}
                    className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 shadow-md space-y-3 transition-all hover:border-slate-600"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-base shrink-0">
                          🚏
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">{fav.stopName}</div>
                          <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="text-amber-400 font-semibold">#{fav.stopCode}</span>
                            {distanceMeters !== undefined && (
                              <>
                                <span>•</span>
                                <span>A {formatDistance(distanceMeters)}</span>
                              </>
                            )}
                          </div>
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

                    {stop && stop.nextArrivals.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700/60 space-y-2">
                        <div className="text-xs font-semibold text-slate-300">Próximas llegadas:</div>
                        <div className="grid grid-cols-2 gap-2">
                          {stop.nextArrivals.slice(0, 4).map((arr) => (
                            <div
                              key={arr.id}
                              className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/40 flex items-center justify-between"
                            >
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="px-1.5 py-0.5 rounded text-[10px] font-black text-white"
                                  style={{ backgroundColor: arr.lineColor }}
                                >
                                  {arr.lineCode}
                                </span>
                                <span className="text-xs text-slate-300 truncate max-w-[80px]">
                                  {arr.destination}
                                </span>
                              </div>
                              <span className="text-xs font-bold text-emerald-400">
                                {formatETA(arr.etaSeconds)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

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
                          <span>Ver en mapa</span>
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
                  className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 shadow-md space-y-3 transition-all hover:border-slate-600"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
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
        )
      )}

      {/* Create Favorite Destination Modal */}
      <CreateDestinationFavoriteModal
        isOpen={showCreateDestModal}
        onClose={() => setShowCreateDestModal(false)}
        onSave={(fav) => {
          if (onAddDestinationFavorite) {
            onAddDestinationFavorite(fav);
          }
          setShowCreateDestModal(false);
        }}
        userLocation={userLat !== undefined && userLng !== undefined ? { lat: userLat, lng: userLng, accuracy: 20, heading: null, speed: null, timestamp: Date.now() } : null}
        currentDestination={null}
      />
    </div>
  );
};
