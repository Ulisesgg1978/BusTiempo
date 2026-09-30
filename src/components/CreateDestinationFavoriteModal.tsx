import React, { useState } from 'react';
import {
  X,
  Star,
  Home,
  Building2,
  Dumbbell,
  GraduationCap,
  HeartPulse,
  Coffee,
  ShoppingBag,
  MapPin,
  Crosshair,
  Navigation,
  Sparkles,
} from 'lucide-react';
import { DestinationFavorite, TargetPoint, UserPosition } from '../types/transit';

interface CreateDestinationFavoriteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (fav: DestinationFavorite) => void;
  userLocation: UserPosition | null;
  currentDestination: TargetPoint | null;
  onStartMapSelection?: () => void;
}

const POPULAR_BARCELONA_SPOTS = [
  { name: 'Plaça Catalunya', lat: 41.3879, lng: 2.1699, icon: '🏛️' },
  { name: 'Sagrada Família', lat: 41.4036, lng: 2.1744, icon: '⛪' },
  { name: 'Estació de Sants', lat: 41.3792, lng: 2.1402, icon: '🚆' },
  { name: 'Passeig de Gràcia / Diagonal', lat: 41.3965, lng: 2.1601, icon: '🛍️' },
  { name: 'Arc de Triomf / Ciutadella', lat: 41.3911, lng: 2.1806, icon: '🌳' },
  { name: 'Pl. Espanya / Montjuïc', lat: 41.3742, lng: 2.1492, icon: '🏰' },
  { name: 'Platja de la Barceloneta', lat: 41.3784, lng: 2.1895, icon: '🏖️' },
  { name: 'Campus Diagonal / Zona Universitària', lat: 41.3851, lng: 2.1158, icon: '🎓' },
  { name: 'Hospital Clínic', lat: 41.3892, lng: 2.1524, icon: '🏥' },
  { name: 'Glòries / Torre Glòries', lat: 41.4035, lng: 2.1891, icon: '🏢' },
];

export const CreateDestinationFavoriteModal: React.FC<CreateDestinationFavoriteModalProps> = ({
  isOpen,
  onClose,
  onSave,
  userLocation,
  currentDestination,
  onStartMapSelection,
}) => {
  const [name, setName] = useState(currentDestination?.name || '');
  const [category, setCategory] = useState<DestinationFavorite['category']>('favorite');
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number }>(() => {
    if (currentDestination) {
      return { lat: currentDestination.lat, lng: currentDestination.lng };
    }
    if (userLocation) {
      return { lat: userLocation.lat, lng: userLocation.lng };
    }
    return { lat: 41.3879, lng: 2.1699 };
  });
  const [locationSource, setLocationSource] = useState<'current_dest' | 'gps' | 'preset' | 'map'>(
    currentDestination ? 'current_dest' : userLocation ? 'gps' : 'preset'
  );

  if (!isOpen) return null;

  const categories: {
    id: DestinationFavorite['category'];
    label: string;
    icon: string;
    lucide: React.ReactNode;
    color: string;
  }[] = [
    { id: 'home', label: 'Casa', icon: '🏠', lucide: <Home className="w-3.5 h-3.5" />, color: 'text-blue-400 border-blue-500' },
    { id: 'work', label: 'Trabajo', icon: '💼', lucide: <Building2 className="w-3.5 h-3.5" />, color: 'text-amber-400 border-amber-500' },
    { id: 'gym', label: 'Gimnasio', icon: '🏋️', lucide: <Dumbbell className="w-3.5 h-3.5" />, color: 'text-emerald-400 border-emerald-500' },
    { id: 'study', label: 'Estudio', icon: '🎓', lucide: <GraduationCap className="w-3.5 h-3.5" />, color: 'text-indigo-400 border-indigo-500' },
    { id: 'health', label: 'Salud', icon: '🏥', lucide: <HeartPulse className="w-3.5 h-3.5" />, color: 'text-rose-400 border-rose-500' },
    { id: 'leisure', label: 'Ocio', icon: '☕', lucide: <Coffee className="w-3.5 h-3.5" />, color: 'text-orange-400 border-orange-500' },
    { id: 'shopping', label: 'Compras', icon: '🛍️', lucide: <ShoppingBag className="w-3.5 h-3.5" />, color: 'text-pink-400 border-pink-500' },
    { id: 'favorite', label: 'Favorito', icon: '⭐', lucide: <Star className="w-3.5 h-3.5" />, color: 'text-purple-400 border-purple-500' },
  ];

  const handleSelectPreset = (spot: { name: string; lat: number; lng: number; icon: string }) => {
    setSelectedCoords({ lat: spot.lat, lng: spot.lng });
    setLocationSource('preset');
    if (!name) {
      setName(spot.name);
    }
  };

  const handleUseGps = () => {
    if (userLocation) {
      setSelectedCoords({ lat: userLocation.lat, lng: userLocation.lng });
      setLocationSource('gps');
      if (!name) {
        setName('Mi Ubicación');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const catObj = categories.find((c) => c.id === category);

    const newFav: DestinationFavorite = {
      id: `fav-dest-${Date.now()}`,
      name: trimmedName,
      category,
      lat: selectedCoords.lat,
      lng: selectedCoords.lng,
      icon: catObj?.icon || '⭐',
      createdAt: Date.now(),
    };

    onSave(newFav);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full md:max-w-md bg-slate-900 border-t md:border border-purple-500/50 rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden animate-in slide-in-from-bottom-6 md:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300">
              <Star className="w-4 h-4 fill-purple-400 text-purple-300" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Nuevo Destino Favorito</h3>
              <p className="text-[11px] text-slate-400">Guarda un lugar frecuente para viajar con 1 toque</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Name Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Nombre del destino:</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Mi Casa, Oficina Diagonal, Gym..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
              autoFocus
            />
            {/* Quick chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {['Casa', 'Trabajo', 'Gimnasio', 'Universidad', 'Pl. Catalunya', 'Sagrada Família'].map((sug) => (
                <button
                  type="button"
                  key={sug}
                  onClick={() => setName(sug)}
                  className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                >
                  + {sug}
                </button>
              ))}
            </div>
          </div>

          {/* Category Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Categoría:</label>
            <div className="grid grid-cols-4 gap-1.5">
              {categories.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    className={`py-2 px-1 rounded-xl border flex flex-col items-center gap-1 text-[11px] font-bold transition-all ${
                      isSelected
                        ? 'bg-purple-900/60 border-purple-400 text-white shadow-md ring-1 ring-purple-400'
                        : 'bg-slate-800/60 border-slate-700/70 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-base">{cat.icon}</span>
                    <span className="truncate w-full text-center">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Location Picker Options */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300">Ubicación del destino:</label>

            <div className="grid grid-cols-2 gap-1.5">
              {/* Option 1: Destination active on map */}
              {currentDestination && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCoords({ lat: currentDestination.lat, lng: currentDestination.lng });
                    setLocationSource('current_dest');
                  }}
                  className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                    locationSource === 'current_dest'
                      ? 'bg-purple-900/40 border-purple-400 text-white'
                      : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <MapPin className="w-4 h-4 text-purple-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold truncate">Destino del mapa</div>
                    <div className="text-[9px] text-slate-400 truncate">
                      {currentDestination.name || 'Punto actual fijado'}
                    </div>
                  </div>
                </button>
              )}

              {/* Option 2: Current GPS */}
              {userLocation && (
                <button
                  type="button"
                  onClick={handleUseGps}
                  className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                    locationSource === 'gps'
                      ? 'bg-blue-900/40 border-blue-400 text-white'
                      : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Navigation className="w-4 h-4 text-blue-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold truncate">Mi GPS actual</div>
                    <div className="text-[9px] text-slate-400 truncate">Guardar aquí</div>
                  </div>
                </button>
              )}

              {/* Option 3: Pick on Map */}
              {onStartMapSelection && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onStartMapSelection();
                  }}
                  className="p-2.5 rounded-xl border bg-slate-800/70 border-slate-700 hover:border-purple-400 text-purple-300 text-left flex items-center gap-2 transition-all"
                >
                  <Crosshair className="w-4 h-4 text-purple-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold truncate">Tocar en mapa</div>
                    <div className="text-[9px] text-slate-400 truncate">Marcar posición</div>
                  </div>
                </button>
              )}
            </div>

            {/* Popular Spots in Barcelona */}
            <div className="pt-2">
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mb-1.5">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Lugares populares en Barcelona:</span>
              </span>
              <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                {POPULAR_BARCELONA_SPOTS.map((spot) => {
                  const isMatch =
                    Math.abs(selectedCoords.lat - spot.lat) < 0.001 &&
                    Math.abs(selectedCoords.lng - spot.lng) < 0.001;
                  return (
                    <button
                      type="button"
                      key={spot.name}
                      onClick={() => handleSelectPreset(spot)}
                      className={`p-1.5 rounded-lg border text-left flex items-center gap-1.5 text-[11px] transition-all ${
                        isMatch
                          ? 'bg-amber-950/60 border-amber-400 text-amber-200 font-bold'
                          : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span>{spot.icon}</span>
                      <span className="truncate">{spot.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition-all active:scale-[0.98]"
            >
              Guardar Favorito ⭐
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
