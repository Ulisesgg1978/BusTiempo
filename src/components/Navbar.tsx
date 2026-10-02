import React, { useState, useRef, useEffect } from 'react';
import { Bus, MapPin, Moon, Sun, WifiOff, Target, Radar, Search, ChevronDown, Info, ShieldCheck, BusFront } from 'lucide-react';
import { formatDistance } from '../utils/geo';

export type VehicleDisplayMode = 'none' | 'in_radius' | 'all';

interface NavbarProps {
  isDarkMode: boolean;
  isOffline: boolean;
  onToggleTheme: () => void;
  // Circular buttons in top bar: Destino, Buses, Radio, Paradas
  onOpenDestination: () => void;
  hasDestination?: boolean;
  destinationName?: string;
  vehicleDisplayMode: VehicleDisplayMode;
  onCycleVehicleMode: () => void;
  searchRadiusMeters: number;
  onOpenRadius: () => void;
  showStops: boolean;
  onToggleStops: () => void;
  onOpenAddressSearch: () => void;
  providerLabel?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  isDarkMode,
  isOffline,
  onToggleTheme,
  onOpenDestination,
  hasDestination = false,
  destinationName,
  vehicleDisplayMode,
  onCycleVehicleMode,
  searchRadiusMeters,
  onOpenRadius,
  showStops,
  onToggleStops,
  onOpenAddressSearch,
  providerLabel = 'TMB · AMB · Renfe · FGC',
}) => {
  const [isAppMenuOpen, setIsAppMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsAppMenuOpen(false);
      }
    };
    if (isAppMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAppMenuOpen]);

  // Visual configuration for the 3 vehicle modes (icon and text fit inside the circle)
  const getVehicleButtonConfig = () => {
    switch (vehicleDisplayMode) {
      case 'none':
        return {
          text: 'OFF',
          fullLabel: 'Sin vehículos',
          title: 'Sin mostrar vehículos (autobuses, metros, trenes). Pulsa para mostrar en radio de acción.',
          className: 'bg-slate-800/90 border-slate-700/80 text-slate-400 hover:text-slate-200 hover:border-slate-500',
          textClass: 'text-slate-400',
          icon: <Bus className="w-3.5 h-3.5 text-slate-500 opacity-60 shrink-0" />,
        };
      case 'in_radius':
        return {
          text: 'RADIO',
          fullLabel: 'En radio',
          title: 'Mostrando transportes con parada en el radio de acción. Pulsa para mostrar todos.',
          className: 'bg-blue-600/25 border-blue-400 text-blue-300 ring-2 ring-blue-500/40 shadow-md shadow-blue-950/30',
          textClass: 'text-blue-300',
          icon: <Bus className="w-3.5 h-3.5 text-blue-400 shrink-0" />,
        };
      case 'all':
      default:
        return {
          text: 'TODOS',
          fullLabel: 'Todos los transportes',
          title: 'Mostrando todos los transportes en la red. Pulsa para ocultar vehículos.',
          className: 'bg-emerald-600/25 border-emerald-400 text-emerald-300 ring-2 ring-emerald-500/40 shadow-md shadow-emerald-950/30',
          textClass: 'text-emerald-300',
          icon: <Bus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
        };
    }
  };

  const vehicleConfig = getVehicleButtonConfig();

  return (
    <header
      id="app-navbar"
      className="h-14 px-3 sm:px-4 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white flex items-center justify-between shrink-0 z-[600]"
    >
      {/* Brand Title converted into Dropdown Menu Button */}
      <div className="relative" ref={menuRef}>
        <button
          id="btn-app-menu-toggle"
          onClick={() => setIsAppMenuOpen((prev) => !prev)}
          className="flex items-center gap-2 px-1.5 py-1 -ml-1 rounded-2xl hover:bg-slate-800/80 transition-all active:scale-95 text-left group"
          title="Menú de opciones de BusTiempo"
          aria-expanded={isAppMenuOpen}
        >
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-600/30 shrink-0 group-hover:bg-blue-500 transition-colors">
            <BusFront className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-black text-sm sm:text-base leading-none tracking-tight flex items-center gap-1">
              <span>BusTiempo</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-transform duration-200 ${
                  isAppMenuOpen ? 'rotate-180 text-blue-400' : ''
                }`}
              />
            </h1>
            <span className="text-[10px] text-slate-400 leading-none block font-medium mt-0.5">
              Barcelona Transit
            </span>
          </div>
        </button>

        {/* Dropdown Menu Modal */}
        {isAppMenuOpen && (
          <div
            id="app-dropdown-menu"
            className="absolute left-0 top-12 mt-1 w-72 bg-slate-900/95 backdrop-blur-xl border border-slate-700/90 rounded-2xl p-2.5 shadow-2xl z-[700] space-y-1 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Header info */}
            <div className="px-3 py-2 border-b border-slate-800">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>BusTiempo Barcelona</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-blue-500/20 text-blue-400 border border-blue-500/30 font-extrabold">
                  v2.5
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Red Metropolitana Oficial de Barcelona
              </p>
            </div>

            {/* Menu Option 1: Modo Claro / Modo Oscuro Toggle */}
            <button
              id="btn-menu-toggle-theme"
              onClick={() => {
                onToggleTheme();
                setIsAppMenuOpen(false);
              }}
              className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-300 shrink-0">
                  {isDarkMode ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-blue-300" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">
                    {isDarkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Tema actual: {isDarkMode ? 'Oscuro' : 'Claro'}
                  </div>
                </div>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-semibold">
                {isDarkMode ? '☀️ Claro' : '🌙 Oscuro'}
              </span>
            </button>

            {/* Menu Option 2: Buscar Dirección */}
            <button
              id="btn-menu-search-address"
              onClick={() => {
                onOpenAddressSearch();
                setIsAppMenuOpen(false);
              }}
              className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                  <Search className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Buscar Dirección</div>
                  <div className="text-[10px] text-slate-400">Fijar destino o explorar mapa</div>
                </div>
              </div>
              <span className="text-xs text-slate-400">➔</span>
            </button>

            {/* Menu Information: Data Sources */}
            <div className="pt-2 border-t border-slate-800 px-3 py-2 text-[10px] text-slate-400 space-y-1">
              <div className="flex items-center gap-1 text-slate-300 font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Datos oficiales integrados:</span>
              </div>
              <p className="leading-relaxed text-slate-400">
                • <strong>TMB Open Data</strong> (Bus diurno & Metro L1-L5)<br />
                • <strong>AMB Nitbus</strong> (Líneas nocturnas N0-N28)<br />
                • <strong>Rodalies de Catalunya</strong> (Renfe Cercanías)<br />
                • <strong>FGC</strong> (Ferrocarrils de la Generalitat)<br />
                • <strong>ATM</strong> (Autoritat del Transport Metropolità)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Circular Action Buttons: Destino, Buses (3 modos), Radio, Paradas */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* 1. Destino */}
        <button
          id="btn-navbar-destino"
          onClick={onOpenDestination}
          className={`flex items-center justify-center gap-1.5 h-9 w-9 sm:w-auto sm:px-3 rounded-full border transition-all active:scale-95 text-xs font-bold ${
            hasDestination
              ? 'bg-purple-600/25 border-purple-400 text-purple-300 ring-2 ring-purple-500/40 shadow-md shadow-purple-900/30'
              : 'bg-slate-800/90 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
          }`}
          title={
            hasDestination
              ? `Destino: ${destinationName || 'Fijado'} (Pulsa para ver/cambiar)`
              : 'Fijar destino o ver coincidencias'
          }
        >
          <Target className={`w-4 h-4 shrink-0 ${hasDestination ? 'text-purple-400 animate-pulse' : 'text-purple-400'}`} />
          <span className="hidden sm:inline">
            {hasDestination ? 'Destino ✓' : 'Destino'}
          </span>
        </button>

        {/* 2. Buses (Alterna entre 3 modos: Sin vehículos, En radio de acción, Todos los transportes) */}
        {/* Botón circular: tanto el icono como el texto quedan 100% dentro del círculo */}
        <button
          id="btn-navbar-buses"
          onClick={onCycleVehicleMode}
          className={`flex flex-col items-center justify-center w-11 h-11 rounded-full aspect-square border transition-all active:scale-90 shadow-sm shrink-0 p-0.5 overflow-hidden ${vehicleConfig.className}`}
          title={vehicleConfig.title}
          aria-label={`Modo de vehículos: ${vehicleConfig.fullLabel}`}
        >
          {vehicleConfig.icon}
          <span className={`text-[7.5px] font-black uppercase tracking-tight leading-none mt-0.5 select-none ${vehicleConfig.textClass}`}>
            {vehicleConfig.text}
          </span>
        </button>

        {/* 3. Radio */}
        <button
          id="btn-navbar-radio"
          onClick={onOpenRadius}
          className="flex items-center justify-center gap-1.5 h-9 w-9 sm:w-auto sm:px-3 rounded-full border border-slate-700 bg-slate-800/90 hover:bg-slate-700 hover:text-white text-slate-300 transition-all active:scale-95 text-xs font-bold"
          title={`Radio de búsqueda actual: ±${formatDistance(searchRadiusMeters)} (Pulsa para cambiar)`}
        >
          <Radar className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="hidden sm:inline">
            Radio <span className="text-[10px] text-amber-300 font-semibold">±{formatDistance(searchRadiusMeters)}</span>
          </span>
        </button>

        {/* 4. Paradas */}
        <button
          id="btn-navbar-paradas"
          onClick={onToggleStops}
          className={`flex items-center justify-center gap-1.5 h-9 w-9 sm:w-auto sm:px-3 rounded-full border transition-all active:scale-95 text-xs font-bold ${
            showStops
              ? 'bg-emerald-600/25 border-emerald-400 text-emerald-300 shadow-sm'
              : 'bg-slate-800/90 border-slate-700/80 text-slate-400 hover:text-slate-200'
          }`}
          title={showStops ? 'Paradas en mapa: Visibles (Pulsa para ocultar)' : 'Paradas en mapa: Ocultas (Pulsa para mostrar)'}
        >
          <MapPin className={`w-4 h-4 shrink-0 ${showStops ? 'text-emerald-400' : 'text-slate-400'}`} />
          <span className="hidden sm:inline">Paradas</span>
        </button>
      </div>

      {/* Right Tools: Buscar Dirección Button (replaces former theme toggle) + Offline Badge */}
      <div className="flex items-center gap-1.5">
        {isOffline && (
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[11px] font-bold"
            title="Sin conexión: mostrando datos guardados en caché local"
          >
            <WifiOff className="w-3 h-3" />
            <span className="hidden md:inline">Offline</span>
          </div>
        )}

        {/* Botón de Buscar Dirección en la barra superior (en lugar del botón de tema) */}
        <button
          id="btn-navbar-search-address"
          onClick={onOpenAddressSearch}
          className="flex items-center justify-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-full bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-all active:scale-95 text-xs font-bold shadow-sm"
          title="Buscar dirección en Barcelona (fijar destino o explorar mapa)"
          aria-label="Buscar dirección"
        >
          <Search className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="hidden md:inline">Buscar dirección</span>
        </button>
      </div>
    </header>
  );
};

