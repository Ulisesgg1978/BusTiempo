import React from 'react';
import { Bus, MapPin, Moon, Sun, WifiOff, Navigation2 } from 'lucide-react';

interface NavbarProps {
  cityName: string;
  isDarkMode: boolean;
  isOffline: boolean;
  isGpsActive: boolean;
  onToggleTheme: () => void;
  onOpenLocationModal: () => void;
  onRequestGPS: () => void;
  providerLabel?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  cityName,
  isDarkMode,
  isOffline,
  isGpsActive,
  onToggleTheme,
  onOpenLocationModal,
  onRequestGPS,
  providerLabel = 'TMB Barcelona',
}) => {
  return (
    <header
      id="app-navbar"
      className="h-14 px-4 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white flex items-center justify-between shrink-0 z-[600]"
    >
      {/* Brand Title */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-600/30">
          <Bus className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-extrabold text-base leading-none tracking-tight flex items-center gap-1.5">
            <span>BusTiempo</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold">
              GPS
            </span>
            <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
              {providerLabel}
            </span>
          </h1>
        </div>
      </div>

      {/* Center Location selector pill */}
      <div className="flex items-center gap-1.5">
        <button
          id="btn-navbar-location"
          onClick={onOpenLocationModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700/80 border border-slate-700/70 text-xs font-semibold text-slate-200 transition-all active:scale-95 shadow-sm max-w-[140px] sm:max-w-[200px]"
          title="Cambiar ciudad o ubicación"
        >
          <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="truncate">{cityName}</span>
        </button>

        {/* GPS quick button */}
        <button
          id="btn-navbar-gps-sync"
          onClick={onRequestGPS}
          className={`p-2 rounded-full border transition-all ${
            isGpsActive
              ? 'bg-blue-600/20 border-blue-500/50 text-blue-400'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
          }`}
          title={isGpsActive ? 'GPS Activo' : 'Activar GPS'}
          aria-label="GPS"
        >
          <Navigation2 className={`w-3.5 h-3.5 ${isGpsActive ? 'text-blue-400' : ''}`} />
        </button>
      </div>

      {/* Right Tools (Offline Badge + Dark/Light toggle) */}
      <div className="flex items-center gap-1.5">
        {isOffline && (
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[11px] font-bold"
            title="Sin conexión: mostrando datos guardados en caché local"
          >
            <WifiOff className="w-3 h-3" />
            <span className="hidden sm:inline">Offline</span>
          </div>
        )}

        <button
          id="btn-toggle-theme"
          onClick={onToggleTheme}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
          title={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          aria-label="Tema"
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
