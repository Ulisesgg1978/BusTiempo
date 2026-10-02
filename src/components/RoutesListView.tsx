import React, { useState } from 'react';
import { BusLine, BusStop, LiveBus, FavoriteItem } from '../types/transit';
import { Star, Bus, Search, ArrowRight, Activity, Clock, Train, Moon } from 'lucide-react';
import { getLineOperatingStatus } from '../utils/operatingHours';

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
  const [filterType, setFilterType] = useState<'all' | 'bus' | 'nitbus' | 'metro' | 'rodalies' | 'fgc'>('all');
  const [expandedLineId, setExpandedLineId] = useState<string | null>(null);

  const getLineType = (line: BusLine): 'bus' | 'nitbus' | 'metro' | 'rodalies' | 'fgc' => {
    if (line.transportType === 'nitbus' || line.code.startsWith('N')) return 'nitbus';
    if (line.transportType === 'rodalies' || line.code.startsWith('R')) return 'rodalies';
    if (line.transportType === 'fgc' || line.code.startsWith('S') || (line.code.startsWith('L') && parseInt(line.code.slice(1)) >= 6)) return 'fgc';
    if (line.transportType === 'metro' || line.code.startsWith('L') || line.code === 'FM') return 'metro';
    return 'bus';
  };

  const filteredLines = lines.filter((l) => {
    const type = getLineType(l);
    if (filterType !== 'all' && type !== filterType) return false;

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.code.toLowerCase().includes(q) ||
      l.name.toLowerCase().includes(q) ||
      l.origin.toLowerCase().includes(q) ||
      l.destination.toLowerCase().includes(q)
    );
  });

  const busCount = lines.filter((l) => getLineType(l) === 'bus').length;
  const nitbusCount = lines.filter((l) => getLineType(l) === 'nitbus').length;
  const metroCount = lines.filter((l) => getLineType(l) === 'metro').length;
  const rodaliesCount = lines.filter((l) => getLineType(l) === 'rodalies').length;
  const fgcCount = lines.filter((l) => getLineType(l) === 'fgc').length;

  return (
    <div id="routes-list-view" className="h-full overflow-y-auto px-4 py-4 pb-24 space-y-4">
      {/* Header with live count */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Bus className="w-5 h-5 text-blue-400" />
            Líneas de Barcelona
          </h2>
          <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30">
            {lines.length} líneas
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          TMB Bus, Nitbus nocturnos, Metro, Rodalies de Renfe y FGC con horarios y estado en tiempo real
        </p>
      </div>

      {/* Filter Tabs by Mode */}
      <div className="flex items-center gap-1 p-1 bg-slate-900/80 rounded-xl border border-slate-800 text-[11px] font-semibold overflow-x-auto scrollbar-none">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1.5 rounded-lg transition-all shrink-0 ${
            filterType === 'all'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Todas ({lines.length})
        </button>
        <button
          onClick={() => setFilterType('bus')}
          className={`px-2.5 py-1.5 rounded-lg transition-all shrink-0 flex items-center gap-1 ${
            filterType === 'bus'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Bus className="w-3 h-3" />
          <span>Bus ({busCount})</span>
        </button>
        <button
          onClick={() => setFilterType('nitbus')}
          className={`px-2.5 py-1.5 rounded-lg transition-all shrink-0 flex items-center gap-1 ${
            filterType === 'nitbus'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Moon className="w-3 h-3 text-amber-300" />
          <span>Nitbus ({nitbusCount})</span>
        </button>
        <button
          onClick={() => setFilterType('metro')}
          className={`px-2.5 py-1.5 rounded-lg transition-all shrink-0 flex items-center gap-1 ${
            filterType === 'metro'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Train className="w-3 h-3" />
          <span>Metro ({metroCount})</span>
        </button>
        <button
          onClick={() => setFilterType('rodalies')}
          className={`px-2.5 py-1.5 rounded-lg transition-all shrink-0 flex items-center gap-1 ${
            filterType === 'rodalies'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>🚆 Rodalies ({rodaliesCount})</span>
        </button>
        <button
          onClick={() => setFilterType('fgc')}
          className={`px-2.5 py-1.5 rounded-lg transition-all shrink-0 flex items-center gap-1 ${
            filterType === 'fgc'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>🚉 FGC ({fgcCount})</span>
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
          placeholder="Buscar por línea (ej: N1, R1, L1, H12, 24...), destino o estación..."
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
            const opStatus = getLineOperatingStatus(line);

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

                      {/* Real Operational Schedule and In-Service Status */}
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold border ${opStatus.statusColor}`}>
                          {opStatus.statusBadge}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Horario: {opStatus.scheduleText}
                        </span>
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
                          : 'bg-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-700'
                      }`}
                      title={isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                    >
                      <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400' : ''}`} />
                    </button>

                    <button
                      onClick={() => onSelectLine(line)}
                      className="p-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 transition-colors"
                      title="Ver trazado en el mapa"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Sub details: real active vehicles & stops */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-700/50 space-y-3 bg-slate-900/40">
                    <div className="flex items-center justify-between text-xs text-slate-300 pt-2">
                      <div className="flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-blue-400" />
                        <span>
                          Vehículos en circulación:{' '}
                          <strong className="text-white">{activeBusesOnLine.length}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Frecuencia: {line.frequencyMinutes} min</span>
                      </div>
                    </div>

                    {!opStatus.inService && (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                        {opStatus.reason || 'Esta línea se encuentra fuera de su horario de servicio actual.'}
                      </div>
                    )}

                    {lineStops.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-slate-400 mb-2">
                          Paradas principales ({lineStops.length}):
                        </div>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {lineStops.map((stop, sIdx) => (
                            <div
                              key={stop.id}
                              onClick={() => onSelectStop(stop)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/40 text-xs text-white flex items-center justify-between cursor-pointer transition-colors"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="text-[10px] font-bold text-slate-400 w-5 text-center">
                                  #{sIdx + 1}
                                </span>
                                <span className="truncate">{stop.name}</span>
                              </div>
                              <span className="text-[10px] text-blue-400 shrink-0 font-medium">
                                #{stop.code}
                              </span>
                            </div>
                          ))}
                        </div>
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
