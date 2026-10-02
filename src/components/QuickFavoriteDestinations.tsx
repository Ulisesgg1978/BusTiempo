import React, { useState } from 'react';
import { Home, Briefcase, Dumbbell, Star, MapPin, Edit2, Check, X } from 'lucide-react';
import { TargetPoint } from '../types/transit';

export interface QuickFavorite {
  id: 'casa' | 'trabajo' | 'fav3' | 'fav4';
  label: string;
  defaultName: string;
  iconType: 'home' | 'work' | 'gym' | 'star';
  lat: number;
  lng: number;
  isConfigured: boolean;
}

const DEFAULT_QUICK_FAVORITES: QuickFavorite[] = [
  {
    id: 'casa',
    label: 'Casa',
    defaultName: 'Casa (Gràcia / Eixample)',
    iconType: 'home',
    lat: 41.3985,
    lng: 2.1580,
    isConfigured: true,
  },
  {
    id: 'trabajo',
    label: 'Trabajo',
    defaultName: 'Trabajo (Pl. Catalunya / Diagonal)',
    iconType: 'work',
    lat: 41.3870,
    lng: 2.1691,
    isConfigured: true,
  },
  {
    id: 'fav3',
    label: 'Gym',
    defaultName: 'Gimnasio / Ocio (Barceloneta)',
    iconType: 'gym',
    lat: 41.3768,
    lng: 2.1895,
    isConfigured: true,
  },
  {
    id: 'fav4',
    label: 'Favorito',
    defaultName: 'Sagrada Família',
    iconType: 'star',
    lat: 41.4036,
    lng: 2.1744,
    isConfigured: true,
  },
];

interface QuickFavoriteDestinationsProps {
  currentDestination: TargetPoint | null;
  onSelectDestination: (lat: number, lng: number, name: string) => void;
  userLocationLat?: number;
  userLocationLng?: number;
  onOpenFavoriteStops?: () => void;
}

export const QuickFavoriteDestinations: React.FC<QuickFavoriteDestinationsProps> = ({
  currentDestination,
  onSelectDestination,
  userLocationLat,
  userLocationLng,
  onOpenFavoriteStops,
}) => {
  const [favorites, setFavorites] = useState<QuickFavorite[]>(() => {
    try {
      const stored = localStorage.getItem('bustiempo_quick_dest_favs');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    return DEFAULT_QUICK_FAVORITES;
  });

  const [editingFav, setEditingFav] = useState<QuickFavorite | null>(null);
  const [editName, setEditName] = useState('');

  const saveFavorites = (updated: QuickFavorite[]) => {
    setFavorites(updated);
    try {
      localStorage.setItem('bustiempo_quick_dest_favs', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const handleEditClick = (fav: QuickFavorite, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFav(fav);
    setEditName(fav.defaultName);
  };

  const handleSaveEdit = () => {
    if (!editingFav) return;
    const updated = favorites.map((f) => {
      if (f.id === editingFav.id) {
        return {
          ...f,
          defaultName: editName.trim() || f.label,
          lat: userLocationLat || f.lat,
          lng: userLocationLng || f.lng,
          isConfigured: true,
        };
      }
      return f;
    });
    saveFavorites(updated);
    setEditingFav(null);
  };

  const renderIcon = (type: QuickFavorite['iconType'], isActive: boolean) => {
    const cls = `w-3.5 h-3.5 shrink-0 ${isActive ? 'text-purple-300' : 'text-slate-400 group-hover:text-white'}`;
    switch (type) {
      case 'home':
        return <Home className={cls} />;
      case 'work':
        return <Briefcase className={cls} />;
      case 'gym':
        return <Dumbbell className={cls} />;
      case 'star':
      default:
        return <Star className={cls} />;
    }
  };

  return (
    <>
      <div className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-3 py-1 flex items-center gap-1.5 overflow-x-auto scrollbar-none z-[550] shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 hidden sm:inline mr-1">
          Destinos rápidos:
        </span>

        {favorites.map((fav) => {
          const isActive =
            currentDestination !== null &&
            Math.hypot(currentDestination.lat - fav.lat, currentDestination.lng - fav.lng) < 0.0004;

          return (
            <div
              key={fav.id}
              className="relative group shrink-0 flex items-center"
            >
              <button
                onClick={() => onSelectDestination(fav.lat, fav.lng, fav.defaultName)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all active:scale-95 shadow-sm ${
                  isActive
                    ? 'bg-purple-600/30 border-purple-400 text-purple-200 ring-1 ring-purple-500/50 shadow-purple-900/20'
                    : 'bg-slate-800/80 hover:bg-slate-700/90 border-slate-700/80 text-slate-300 hover:text-white'
                }`}
                title={`Fijar destino en ${fav.defaultName} (clic para activar)`}
              >
                {renderIcon(fav.iconType, isActive)}
                <span className="truncate max-w-[70px] sm:max-w-[100px] text-[11px] font-bold">
                  {fav.label}
                </span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                )}
              </button>

              {/* Small edit dot button */}
              <button
                onClick={(e) => handleEditClick(fav, e)}
                className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-700 hover:bg-purple-600 text-slate-300 hover:text-white flex items-center justify-center text-[9px] shadow"
                title={`Editar ubicación de ${fav.label}`}
              >
                <Edit2 className="w-2.5 h-2.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Quick Favorite Config / Edit Modal */}
      {editingFav && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                {renderIcon(editingFav.iconType, false)}
                <span>Configurar {editingFav.label}</span>
              </h3>
              <button
                onClick={() => setEditingFav(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                Nombre descriptivo:
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-purple-500"
                placeholder={editingFav.defaultName}
              />
            </div>

            {userLocationLat && userLocationLng && (
              <button
                type="button"
                onClick={() => {
                  setEditName((prev) => (prev ? `${prev} (Ubicación actual)` : 'Mi ubicación actual'));
                }}
                className="w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs flex items-center justify-center gap-1.5 font-medium"
              >
                <MapPin className="w-3.5 h-3.5 text-blue-400" />
                <span>Usar mis coordenadas GPS actuales</span>
              </button>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingFav(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1 shadow"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Guardar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
