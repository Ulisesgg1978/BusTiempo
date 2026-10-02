import React, { useState } from 'react';
import {
  Target,
  Crosshair,
  Star,
  Clock,
  Trash2,
  Plus,
  MapPin,
  X,
  Navigation,
  Check,
  Building2,
  Home,
  Dumbbell,
  Bookmark,
  Sparkles,
  Search,
} from 'lucide-react';
import { TargetPoint, RecentDestination, DestinationFavorite, UserPosition } from '../types/transit';
import { getDistanceMeters, formatDistance } from '../utils/geo';
import { CreateDestinationFavoriteModal } from './CreateDestinationFavoriteModal';

interface DestinationMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onStartMapSelection: () => void;
  onSelectDestination: (lat: number, lng: number, name?: string) => void;
  onClearDestination: () => void;
  currentDestination: TargetPoint | null;
  userLocation: UserPosition | null;
  center: [number, number];
  searchRadius: number;
  recentDestinations: RecentDestination[];
  favoriteDestinations: DestinationFavorite[];
  onAddFavorite: (fav: DestinationFavorite) => void;
  onRemoveFavorite: (id: string) => void;
  onOpenAddressSearch?: () => void;
}

export const DestinationMenu: React.FC<DestinationMenuProps> = ({
  isOpen,
  onClose,
  onStartMapSelection,
  onSelectDestination,
  onClearDestination,
  currentDestination,
  userLocation,
  center,
  searchRadius,
  recentDestinations,
  favoriteDestinations,
  onAddFavorite,
  onRemoveFavorite,
  onOpenAddressSearch,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);

  if (!isOpen) return null;

  const currentLat = userLocation?.lat ?? center[0];
  const currentLng = userLocation?.lng ?? center[1];

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'home':
        return <Home className="w-3.5 h-3.5 text-blue-400" />;
      case 'work':
        return <Building2 className="w-3.5 h-3.5 text-amber-400" />;
      case 'gym':
        return <Dumbbell className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Star className="w-3.5 h-3.5 text-purple-400" />;
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[500] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/40 md:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          className="w-full md:max-w-md bg-slate-900 border-t md:border border-purple-500/50 rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[50vh] max-h-[50vh] md:h-auto md:max-h-[85vh] animate-in slide-in-from-bottom-6 md:zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile visual drag pill */}
          <div className="w-10 h-1 rounded-full bg-slate-700 mx-auto mt-2 -mb-2 md:hidden" />

          {/* Header */}
          <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-black text-white flex items-center gap-2">
                  <span>Fijar Zona de Destino</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                    Radio {formatDistance(searchRadius)}
                  </span>
                </h2>
                <p className="text-[11px] text-slate-400">
                  Selecciona una ubicación frecuente o marca en el mapa
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="p-4 space-y-3.5 overflow-y-auto flex-1">
            {/* Quick Actions Grid */}
            <div className="grid grid-cols-3 gap-2">
              {/* Action 1: Search by address */}
              {onOpenAddressSearch && (
                <button
                  id="btn-dest-search-address"
                  onClick={() => {
                    onOpenAddressSearch();
                    onClose();
                  }}
                  className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white font-bold text-xs flex flex-col justify-between shadow-lg shadow-blue-600/30 active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                      <Search className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[9px] bg-white/20 px-1 py-0.5 rounded font-black">Dirección</span>
                  </div>
                  <div className="text-left mt-2">
                    <div className="font-extrabold text-[11px] leading-tight">Buscar Dirección</div>
                    <div className="text-[9px] text-blue-200 line-clamp-1 mt-0.5">
                      Calles y plazas
                    </div>
                  </div>
                </button>
              )}

              {/* Action 2: Click on Map */}
              <button
                id="btn-dest-pick-map"
                onClick={() => {
                  onStartMapSelection();
                  onClose();
                }}
                className={`p-2.5 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex flex-col justify-between shadow-lg shadow-purple-600/30 active:scale-[0.98] transition-all ${
                  !onOpenAddressSearch ? 'col-span-1' : ''
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                    <Crosshair className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[9px] bg-white/20 px-1 py-0.5 rounded font-black">Tocar</span>
                </div>
                <div className="text-left mt-2">
                  <div className="font-extrabold text-[11px] leading-tight">Marcar en mapa</div>
                  <div className="text-[9px] text-purple-200 line-clamp-1 mt-0.5">
                    Cualquier punto
                  </div>
                </div>
              </button>

              {/* Action 3: Create new favorite destination */}
              <button
                id="btn-dest-create-fav"
                onClick={() => setShowCreateModal(true)}
                className={`p-2.5 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-xs flex flex-col justify-between shadow-lg shadow-amber-600/20 active:scale-[0.98] transition-all ${
                  !onOpenAddressSearch ? 'col-span-1' : ''
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                    <Star className="w-3.5 h-3.5 fill-white" />
                  </div>
                  <span className="text-[9px] bg-white/20 px-1 py-0.5 rounded font-black">+ Nuevo</span>
                </div>
                <div className="text-left mt-2">
                  <div className="font-extrabold text-[11px] leading-tight">Crear Favorito</div>
                  <div className="text-[9px] text-amber-200 line-clamp-1 mt-0.5">
                    Casa, trabajo...
                  </div>
                </div>
              </button>
            </div>

            {/* Current Destination Status (if already active) */}
            {currentDestination && (
              <div className="p-3 rounded-2xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">🎯</span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      {currentDestination.name || 'Destino activo en el mapa'}
                    </div>
                    <div className="text-[10px] text-purple-300">
                      A {formatDistance(getDistanceMeters(currentLat, currentLng, currentDestination.lat, currentDestination.lng))} de tu ubicación
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1 transition-all"
                    title="Guardar en favoritos"
                  >
                    <Star className="w-3 h-3 fill-amber-300" />
                    <span>Guardar</span>
                  </button>
                  <button
                    onClick={() => {
                      onClearDestination();
                      onClose();
                    }}
                    className="px-2 py-1 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-[10px] font-bold text-rose-300 transition-all"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            )}

            {/* Section: Favorite Destinations */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300 px-1">
                <div className="flex items-center gap-1.5 text-amber-400">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  <span>Destinos Favoritos</span>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="text-[10px] text-purple-300 hover:text-white font-bold flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" />
                  <span>Añadir</span>
                </button>
              </div>

              {favoriteDestinations.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 text-center text-xs text-slate-400">
                  Aún no tienes destinos favoritos guardados.
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-1.5 block mx-auto px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px]"
                  >
                    + Crear primer favorito
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-1.5">
                  {favoriteDestinations.map((fav) => {
                    const dist = getDistanceMeters(currentLat, currentLng, fav.lat, fav.lng);
                    const isCurrent =
                      currentDestination &&
                      Math.hypot(currentDestination.lat - fav.lat, currentDestination.lng - fav.lng) < 0.0003;

                    return (
                      <div
                        key={fav.id}
                        onClick={() => {
                          onSelectDestination(fav.lat, fav.lng, fav.name);
                          onClose();
                        }}
                        className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isCurrent
                            ? 'bg-purple-900/40 border-purple-500 text-white ring-1 ring-purple-500/40'
                            : 'bg-slate-800/60 border-slate-700/70 hover:border-slate-500 text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-base shrink-0">{fav.icon || '⭐'}</span>
                          <div className="truncate">
                            <div className="text-xs font-bold truncate flex items-center gap-1.5">
                              <span>{fav.name}</span>
                              {isCurrent && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500 text-white font-black">
                                  ACTIVO
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              {getCategoryIcon(fav.category)}
                              <span>A {formatDistance(dist)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => onRemoveFavorite(fav.id)}
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-slate-700/60 transition-colors"
                            title="Eliminar de favoritos"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section: Recent Destinations (Last 3) */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300 px-1">
                <div className="flex items-center gap-1.5 text-blue-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Últimos Destinos Recientes</span>
                </div>
                <span className="text-[10px] text-slate-500">Últimos 3</span>
              </div>

              {recentDestinations.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 text-center text-xs text-slate-500">
                  Aún no has fijado destinos recientes. Toca en el mapa para marcar uno.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {recentDestinations.slice(0, 3).map((rec, idx) => {
                    const dist = getDistanceMeters(currentLat, currentLng, rec.lat, rec.lng);
                    const isCurrent =
                      currentDestination &&
                      Math.hypot(currentDestination.lat - rec.lat, currentDestination.lng - rec.lng) < 0.0003;

                    return (
                      <div
                        key={rec.id || idx}
                        onClick={() => {
                          onSelectDestination(rec.lat, rec.lng, rec.name);
                          onClose();
                        }}
                        className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isCurrent
                            ? 'bg-purple-900/40 border-purple-500 text-white ring-1 ring-purple-500/40'
                            : 'bg-slate-800/60 border-slate-700/70 hover:border-slate-500 text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">
                            {idx + 1}
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-semibold text-slate-200 truncate">
                              {rec.name}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              A {formatDistance(dist)} • {new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] font-bold text-purple-400 shrink-0 ml-2">
                          Fijar ➔
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated Create Destination Favorite Modal */}
      <CreateDestinationFavoriteModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={(fav) => {
          onAddFavorite(fav);
          setShowCreateModal(false);
        }}
        userLocation={userLocation}
        currentDestination={currentDestination}
        onStartMapSelection={() => {
          setShowCreateModal(false);
          onClose();
          onStartMapSelection();
        }}
      />
    </>
  );
};

