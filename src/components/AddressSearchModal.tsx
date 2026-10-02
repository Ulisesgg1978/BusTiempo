import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Target, X, Navigation, Sparkles, Building, Landmark, Compass } from 'lucide-react';
import { searchBarcelonaAddresses, GeocodedAddress } from '../services/geocodingService';
import { formatDistance, getDistanceMeters } from '../utils/geo';

interface AddressSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAsDestination: (lat: number, lng: number, name: string) => void;
  onExploreLocation: (lat: number, lng: number, name: string) => void;
  userLat?: number;
  userLng?: number;
  initialQuery?: string;
  defaultMode?: 'destination' | 'explore';
}

export const AddressSearchModal: React.FC<AddressSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectAsDestination,
  onExploreLocation,
  userLat,
  userLng,
  initialQuery = '',
  defaultMode = 'destination',
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<GeocodedAddress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
      if (initialQuery.trim().length >= 2) {
        handleSearch(initialQuery);
      } else {
        // Pre-populate with top popular places
        searchBarcelonaAddresses('Plaça').then((res) => setResults(res.slice(0, 5)));
      }
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen, initialQuery]);

  const handleSearch = async (searchTerm: string) => {
    if (searchTerm.trim().length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await searchBarcelonaAddresses(searchTerm);
      setResults(data);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    handleSearch(val);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[750] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Search className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white">Buscar Dirección en Barcelona</h2>
              <p className="text-[11px] text-slate-400">
                Calles, avenidas, plazas y puntos de interés de Barcelona
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input Box */}
        <div className="p-3 border-b border-slate-800/80 bg-slate-950/40 shrink-0">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              placeholder="Escribe calle, plaza, monumento... (ej: Balmes, Gran Via, Sagrada Família)"
              className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-slate-800/90 border border-slate-700 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setResults([]);
                  inputRef.current?.focus();
                }}
                className="absolute right-3 text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Action Explanation Banner */}
        <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-800/50 text-[11px] text-slate-400 flex items-center justify-between shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
            <span>Pulsa <strong className="text-purple-300">🎯 Destino</strong> para buscar líneas y trayecto</span>
          </span>
          <span className="flex items-center gap-1.5 hidden sm:flex">
            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
            <span>o <strong className="text-blue-300">📍 Explorar</strong> para centrar el mapa sin fijar destino</span>
          </span>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading && (
            <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
              <span>Buscando direcciones en Barcelona...</span>
            </div>
          )}

          {!isLoading && results.length === 0 && query.trim().length >= 2 && (
            <div className="py-10 text-center text-xs text-slate-400 space-y-2">
              <p>No se encontraron direcciones para &quot;{query}&quot;.</p>
              <p className="text-[11px] text-slate-500">Prueba buscando por nombre de calle, plaza o avenida principal.</p>
            </div>
          )}

          {!isLoading && results.map((item) => {
            const distFromUser =
              userLat && userLng
                ? getDistanceMeters(userLat, userLng, item.lat, item.lng)
                : null;

            return (
              <div
                key={item.id}
                className="p-3 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-sm group"
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-xl bg-slate-700/60 border border-slate-600/40 flex items-center justify-center text-slate-300 shrink-0 mt-0.5 group-hover:border-purple-400/50 group-hover:text-purple-300 transition-colors">
                    {item.type === 'monument' ? (
                      <Landmark className="w-4 h-4" />
                    ) : item.type === 'station' ? (
                      <Compass className="w-4 h-4" />
                    ) : item.type === 'plaza' ? (
                      <Sparkles className="w-4 h-4" />
                    ) : (
                      <MapPin className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                      <span>{item.name}</span>
                      {distFromUser !== null && (
                        <span className="text-[10px] text-slate-400 font-normal">
                          · {formatDistance(distFromUser)}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                      {item.displayName}
                    </div>
                  </div>
                </div>

                {/* Two Distinct Actions requested: 1. Fijar como Destino | 2. Explorar sin destino */}
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  {/* Action 1: Set as Target Destination */}
                  <button
                    onClick={() => {
                      onSelectAsDestination(item.lat, item.lng, item.name);
                      onClose();
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-900/30 active:scale-95 transition-all"
                    title="Fijar esta dirección como destino para ver rutas y matches"
                  >
                    <Target className="w-3.5 h-3.5" />
                    <span>Destino</span>
                  </button>

                  {/* Action 2: Explore without setting destination */}
                  <button
                    onClick={() => {
                      onExploreLocation(item.lat, item.lng, item.name);
                      onClose();
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-700/80 hover:bg-slate-600 text-slate-200 hover:text-white border border-slate-600/70 text-xs font-semibold active:scale-95 transition-all"
                    title="Centrar mapa aquí para ver paradas y buses cercanos sin fijar destino"
                  >
                    <Navigation className="w-3.5 h-3.5 text-blue-400" />
                    <span>Explorar</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
