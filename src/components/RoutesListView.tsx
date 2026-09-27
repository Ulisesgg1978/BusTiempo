import React, { useState } from 'react';
import { BusLine, BusStop, LiveBus, FavoriteItem } from '../types/transit';
import { Star, Bus, Search, ArrowRight, Activity, Clock, Train } from 'lucide-react';

interface RoutesListViewProps {
  lines: BusLine[];
  stops: BusStop[];
  buses: LiveBus[];
  favorites: FavoriteItem[];
  onSelectLine: (line: BusLine) => void;
  onSelectStop: (stop: BusStop) => void;
  onToggleRouteFavorite: (line: BusLine) => void;
}

export const RoutesListView: React.FC<RoutesListViewProps> = ({
  lines,
  stops,
  buses,
  favorites,
  onSelectLine,
  onSelectStop,
  onToggleRouteFavorite,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'bus' | 'metro'>('all');
  const [expandedLineId, setExpandedLineId] = useState<string | null>(null);

  const filteredLines = lines.filter((l) => {
    const isMetro = l.code.startsWith('L') || l.name.toLowerCase().includes('metro') || l.frequencyMinutes <= 4;
    if (filterType === 'bus' && isMetro) return false;
    if (filterType === 'metro' && !isMetro) return false;

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.code.toLowerCase().includes(q) ||
      l.name.toLowerCase().includes(q) ||
      l.origin.toLowerCase().includes(q) ||
      l.destination.toLowerCase().includes(q)
    );
  });

  const metroCount = lines.filter((l) => l.code.startsWith('L') || l.name.toLowerCase().includes('metro')).length;
  const busCount = lines.length - metroCount;

  return (
    <div id="routes-list-view" className="h-full overflow-y-auto px-4 py-4 pb-24 space-y-4">
      {/* Header with live count */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Bus className="w-5 h-5 text-blue-400" />
            Líneas TMB Barcelona
          </h2>
          <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30">
            {lines.length} líneas oficiales
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Red completa de autobuses y metro de Barcelona conectada a TMB en tiempo real
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-900/80 rounded-xl border border-slate-800 text-xs font-semibold">
        <button
          onClick={() => setFilterType('all')}
          className={`flex-1 py-1.5 rounded-lg transition-all ${
            filterType === 'all'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Todas ({lines.length})
        </button>
        <button
          onClick={() => setFilterType('bus')}
          className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
            filterType === 'bus'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Bus className="w-3.5 h-3.5" />
          Bus ({busCount})
        </button>
        <button
          onClick={() => setFilterType('metro')}
          className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
            filterType === 'metro'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Train className="w-3.5 h-3.5" />
          Metro ({metroCount})
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        <input
          id="input-search-routes"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por línea (ej: H12, V15, 7, 23, L1...), destino o calle..."
          className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-800/80 border border-slate-700/70 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Lines List */}
      <div className="space-y-3">
        {filteredLines.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/50 rounded-2xl border border-slate-800 text-slate-400 text-sm">
            No se encontraron líneas que coincidan con &quot;{searchQuery}&quot;.
          </div>
        ) : (
          filteredLines.map((line) => {
            const isFav = favorites.some((f) => f.type === 'route' && f.lineCode === line.code);
            const activeBusesOnLine = buses.filter((b) => b.lineCode === line.code);
            const lineStops = stops.filter(
              (s) =>
                line.stops.includes(s.id) ||
                line.stops.includes(s.code) ||
                s.lines.includes(line.code)
            );
            const isExpanded = expandedLineId === line.id;

            return (
              <div
                key={line.id}
                id={`route-card-${line.code}`}
                className="rounded-2xl bg-slate-800/80 border border-slate-700/70 overflow-hidden transition-all shadow-md"
              >
                {/* Main Line Card Header */}
                <div className="p-4 flex items-center justify-between gap-3">
                  <div
                    className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                    onClick={() => setExpandedLineId(isExpanded ? null : line.id)}
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white text-base shadow-sm shrink-0"
                      style={{ backgroundColor: line.color }}
                    >
                      {line.code}
                    </div>

                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate flex items-center gap-2">
                        <span>Línea {line.code}</span>
                        <span className="text-xs px-2 py-0.5 rounded-md bg-slate-700 text-slate-300 font-medium">
                          Cada {line.frequencyMinutes}m
                        </span>
                      </div>
                      <div className="text-xs text-slate-300 truncate mt-0.5">
                        {line.name}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {line.origin} ➔ {line.destination}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      id={`btn-fav-route-${line.code}`}
                      onClick={() => onToggleRouteFavorite(line)}
                      className={`p-2 rounded-xl transition-colors ${
                        isFav
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-slate-700/50 text-slate-400 hover:text-white'
                      }`}
                      title={isFav ? 'Quitar ruta de favoritos' : 'Guardar ruta en favoritos'}
                    >
                      <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400' : ''}`} />
                    </button>

                    <button
                      id={`btn-show-line-map-${line.code}`}
                      onClick={() => onSelectLine(line)}
                      className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                      title="Ver ruta completa en el mapa"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Status strip */}
                <div className="px-4 py-2 bg-slate-900/60 border-t border-slate-700/40 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      <strong>{activeBusesOnLine.length}</strong> {line.code.startsWith('L') ? 'trenes' : 'autobuses'} en circulación
                    </span>
                  </div>
                  <button
                    onClick={() => setExpandedLineId(isExpanded ? null : line.id)}
                    className="text-blue-400 hover:text-blue-300 font-semibold"
                  >
                    {isExpanded ? 'Ocultar paradas' : `Ver ${lineStops.length > 0 ? lineStops.length : 'las'} paradas`}
                  </button>
                </div>

                {/* Expanded Stops Timeline */}
                {isExpanded && (
                  <div className="p-4 bg-slate-950/70 border-t border-slate-700/60 space-y-2 text-xs">
                    <span className="font-semibold text-slate-300 block mb-2">
                      Recorrido de paradas (Toca una para ver tiempos en tiempo real):
                    </span>
                    {lineStops.length === 0 ? (
                      <div className="text-slate-400 italic py-2">
                        Paradas de la línea cargándose desde la red TMB...
                      </div>
                    ) : (
                      <div className="relative pl-6 space-y-3 border-l-2 border-slate-700 ml-3 max-h-72 overflow-y-auto pr-2">
                        {lineStops.map((stop) => (
                          <div
                            key={stop.id}
                            onClick={() => onSelectStop(stop)}
                            className="relative cursor-pointer group flex items-center justify-between hover:bg-slate-800/60 p-1.5 rounded-lg transition-colors"
                          >
                            {/* Dot */}
                            <div
                              className="absolute -left-[31px] w-3.5 h-3.5 rounded-full border-2 border-slate-950 shadow"
                              style={{ backgroundColor: line.color }}
                            />

                            <div className="min-w-0 pr-2">
                              <span className="font-semibold text-white group-hover:text-blue-400 transition-colors">
                                {stop.name}
                              </span>
                              <span className="text-[11px] text-slate-400 block">
                                Parada #{stop.code} {stop.address ? `• ${stop.address}` : ''}
                              </span>
                            </div>

                            <span className="text-[11px] text-slate-400 group-hover:text-white shrink-0 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Ver tiempos
                            </span>
                          </div>
                        ))}
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
