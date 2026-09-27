import React from 'react';
import { PRESET_HUBS } from '../services/transitData';
import { MapPin, Navigation, X, Check } from 'lucide-react';

interface LocationSelectorModalProps {
  currentCityName: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset: (name: string, coords: [number, number]) => void;
  onRequestRealGPS: () => void;
  isRealGpsActive: boolean;
}

export const LocationSelectorModal: React.FC<LocationSelectorModalProps> = ({
  currentCityName,
  isOpen,
  onClose,
  onSelectPreset,
  onRequestRealGPS,
  isRealGpsActive,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-700/80 text-white shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-base">Cambiar Ubicación / Red</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 overflow-y-auto">
          {/* Real GPS Option */}
          <button
            id="btn-modal-use-gps"
            onClick={() => {
              onRequestRealGPS();
              onClose();
            }}
            className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
              isRealGpsActive
                ? 'bg-blue-600/20 border-blue-500 text-blue-300 ring-2 ring-blue-500/20'
                : 'bg-slate-800/80 border-slate-700/80 hover:border-slate-600 text-slate-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600/30 text-blue-400 flex items-center justify-center">
                <Navigation className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Mi Ubicación GPS Real</span>
                  {isRealGpsActive && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Detectar coordenadas precisas con el GPS del dispositivo
                </div>
              </div>
            </div>

            {isRealGpsActive && <Check className="w-5 h-5 text-blue-400" />}
          </button>

          <div className="p-3 rounded-2xl bg-blue-950/40 border border-blue-800/40 text-xs text-blue-200 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-blue-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Red Oficial TMB iBus - Barcelona
            </div>
            <p className="text-[11px] text-blue-300/80 leading-relaxed">
              Integrado con el sistema iBus de TMB. Incluye paradas oficiales (#0001, #0010, #0078, etc.) y líneas principales (H12, V15, D20, 24, 7).
            </p>
          </div>

          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider pt-2 px-1">
            Zonas y corredores clave de Barcelona:
          </div>

          <div className="space-y-1.5">
            {PRESET_HUBS.map((preset) => {
              const isSelected = currentCityName === preset.name;
              return (
                <button
                  key={preset.name}
                  onClick={() => {
                    onSelectPreset(preset.name, preset.center);
                    onClose();
                  }}
                  className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                    isSelected
                      ? 'bg-blue-600/20 border-blue-500/50 text-white'
                      : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="text-xs font-medium">{preset.name}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-blue-400" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
