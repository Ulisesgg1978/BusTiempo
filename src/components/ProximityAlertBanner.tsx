import React from 'react';
import { ActiveAlert } from '../types/transit';
import { BellRing, X, Navigation } from 'lucide-react';
import { formatDistance } from '../utils/geo';

interface ProximityAlertBannerProps {
  alert: ActiveAlert | null;
  onDismiss: () => void;
  onViewOnMap: () => void;
}

export const ProximityAlertBanner: React.FC<ProximityAlertBannerProps> = ({
  alert,
  onDismiss,
  onViewOnMap,
}) => {
  if (!alert) return null;

  return (
    <div
      id="proximity-alert-banner"
      className="fixed top-16 left-4 right-4 max-w-md mx-auto z-[999] animate-in slide-in-from-top-6 duration-300"
    >
      <div className="p-4 rounded-2xl bg-amber-500 text-slate-950 shadow-2xl shadow-amber-500/40 border-2 border-amber-300 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center shrink-0 animate-bounce">
            <BellRing className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-wider uppercase px-2 py-0.5 rounded bg-slate-950 text-white">
                ¡Autobús Aproximándose!
              </span>
              <span className="text-xs font-extrabold">{alert.lineCode}</span>
            </div>

            <h4 className="text-sm font-extrabold mt-1 text-slate-950 leading-snug">
              Llegando a {alert.stopName}
            </h4>

            <p className="text-xs text-slate-900 font-medium mt-0.5">
              {alert.lastDistance !== undefined
                ? `A menos de ${formatDistance(alert.lastDistance)} de tu posición actual.`
                : 'Aproximándose a tu parada.'}
            </p>

            <div className="mt-2.5 flex items-center gap-2">
              <button
                id="btn-alert-banner-view"
                onClick={onViewOnMap}
                className="px-3 py-1.5 rounded-lg bg-slate-950 text-amber-300 hover:bg-slate-900 text-xs font-bold flex items-center gap-1 transition-transform active:scale-95 shadow"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Ver en el mapa</span>
              </button>

              <button
                id="btn-alert-banner-dismiss"
                onClick={onDismiss}
                className="px-3 py-1.5 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 text-slate-950 text-xs font-semibold"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="p-1.5 rounded-lg hover:bg-amber-600/40 text-slate-950 transition-colors"
          title="Cerrar aviso"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
