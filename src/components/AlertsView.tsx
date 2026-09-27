import React, { useState } from 'react';
import { ActiveAlert, BusStop, BusLine } from '../types/transit';
import { UserSettings } from '../services/storage';
import {
  hasNotificationPermission,
  requestNotificationPermission,
  sendProximityNotification,
} from '../services/notificationService';
import { Bell, Trash2, Volume2, Vibrate, CheckCircle2, AlertTriangle, Play, Sliders, Compass } from 'lucide-react';
import { formatDistance } from '../utils/geo';

interface AlertsViewProps {
  alerts: ActiveAlert[];
  stops: BusStop[];
  lines: BusLine[];
  settings: UserSettings;
  onUpdateSettings: (newSettings: UserSettings) => void;
  onRemoveAlert: (alertId: string) => void;
  onClearAllAlerts: () => void;
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  alerts,
  stops,
  lines,
  settings,
  onUpdateSettings,
  onRemoveAlert,
  onClearAllAlerts,
}) => {
  const [permStatus, setPermStatus] = useState<string>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );
  const [testSent, setTestSent] = useState(false);

  const handleRequestPermission = async () => {
    const res = await requestNotificationPermission();
    setPermStatus(res);
  };

  const handleTestNotification = () => {
    sendProximityNotification({
      title: '🚌 ¡Autobús L1 aproximándose!',
      body: 'El autobús se encuentra a 350 m de tu parada. Tiempo estimado: 2 minutos.',
      playSound: settings.soundEnabled,
      vibrate: settings.vibrateEnabled,
    });
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  return (
    <div id="alerts-view" className="h-full overflow-y-auto px-4 py-4 pb-24 space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <Bell className="w-5 h-5 text-amber-400" />
          Alertas de Aproximación
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Recibe avisos automáticos en tu móvil cuando un autobús esté cerca de tu ubicación
        </p>
      </div>

      {/* Notification System Permission Status */}
      <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/70 shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                permStatus === 'granted'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              {permStatus === 'granted' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>

            <div>
              <div className="text-sm font-bold text-white">
                {permStatus === 'granted'
                  ? 'Permiso de notificaciones activado'
                  : 'Permiso de notificaciones pendiente'}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {permStatus === 'granted'
                  ? 'Tu dispositivo recibirá notificaciones en primer y segundo plano.'
                  : 'Para recibir alertas en tu barra de notificaciones de Android, concede permiso.'}
              </p>
            </div>
          </div>

          {permStatus !== 'granted' && permStatus !== 'denied' && (
            <button
              id="btn-request-notification-perm"
              onClick={handleRequestPermission}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shrink-0 active:scale-95 transition-all shadow"
            >
              Permitir
            </button>
          )}
        </div>

        {/* Test Notification Button */}
        <div className="mt-3 pt-3 border-t border-slate-700/60 flex items-center justify-between">
          <span className="text-xs text-slate-400">Prueba cómo sonará la alerta:</span>
          <button
            id="btn-test-notification"
            onClick={handleTestNotification}
            className="px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Play className="w-3.5 h-3.5 text-amber-400" />
            {testSent ? '¡Alerta enviada!' : 'Probar sonido y aviso'}
          </button>
        </div>
      </div>

      {/* Proximity Settings */}
      <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/70 shadow-md space-y-4">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-bold text-white">Configuración de Proximidad</h3>
        </div>

        {/* Distance Threshold */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-300 font-medium">Distancia de aviso:</span>
            <span className="text-amber-400 font-bold">
              {formatDistance(settings.alertThresholdMeters)}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[300, 500, 800, 1200].map((dist) => (
              <button
                key={dist}
                onClick={() =>
                  onUpdateSettings({ ...settings, alertThresholdMeters: dist })
                }
                className={`py-1.5 text-xs font-semibold rounded-xl border transition-all ${
                  settings.alertThresholdMeters === dist
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow'
                    : 'bg-slate-900/60 text-slate-300 border-slate-700 hover:border-slate-600'
                }`}
              >
                {formatDistance(dist)}
              </button>
            ))}
          </div>
        </div>

        {/* Sound and Vibration Toggles */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={() =>
              onUpdateSettings({
                ...settings,
                soundEnabled: !settings.soundEnabled,
              })
            }
            className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
              settings.soundEnabled
                ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                : 'bg-slate-900/50 border-slate-700/60 text-slate-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              <span className="font-semibold">Sonido de timbre</span>
            </div>
            <span className="font-bold">{settings.soundEnabled ? 'SÍ' : 'NO'}</span>
          </button>

          <button
            onClick={() =>
              onUpdateSettings({
                ...settings,
                vibrateEnabled: !settings.vibrateEnabled,
              })
            }
            className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
              settings.vibrateEnabled
                ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                : 'bg-slate-900/50 border-slate-700/60 text-slate-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <Vibrate className="w-4 h-4" />
              <span className="font-semibold">Vibración</span>
            </div>
            <span className="font-bold">{settings.vibrateEnabled ? 'SÍ' : 'NO'}</span>
          </button>
        </div>
      </div>

      {/* Stop Search Radius Configuration Card */}
      <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/70 shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white">Radio de Búsqueda de Paradas</h3>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            {formatDistance(settings.searchRadiusMeters)}
          </span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Define el alcance en metros alrededor de tu ubicación para filtrar paradas cercanas, mostrarlas en el mapa con mayor contraste y calcular llegadas.
        </p>

        {/* Quick preset buttons */}
        <div className="space-y-1.5">
          <div className="text-[11px] text-slate-400 font-medium">Accesos directos de distancia:</div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[300, 500, 800, 1000, 1500, 2500].map((radius) => (
              <button
                key={radius}
                onClick={() =>
                  onUpdateSettings({ ...settings, searchRadiusMeters: radius })
                }
                className={`py-2 px-1 text-xs font-semibold rounded-xl border transition-all ${
                  settings.searchRadiusMeters === radius
                    ? 'bg-blue-600 text-white border-blue-400 font-bold shadow-md shadow-blue-500/30'
                    : 'bg-slate-900/60 text-slate-300 border-slate-700 hover:border-slate-500'
                }`}
              >
                {formatDistance(radius)}
              </button>
            ))}
          </div>
        </div>

        {/* Continuous Range Slider */}
        <div className="pt-2 space-y-1.5 border-t border-slate-700/60">
          <div className="flex justify-between items-center text-xs text-slate-300">
            <span>Ajuste con barra deslizante:</span>
            <span className="font-bold text-blue-400">{formatDistance(settings.searchRadiusMeters)}</span>
          </div>
          <input
            type="range"
            min="100"
            max="5000"
            step="50"
            value={settings.searchRadiusMeters}
            onChange={(e) =>
              onUpdateSettings({ ...settings, searchRadiusMeters: Number(e.target.value) })
            }
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-medium">
            <span>100 m</span>
            <span>1 km</span>
            <span>2.5 km</span>
            <span>5 km</span>
          </div>
        </div>
      </div>

      {/* Realtime Transit Provider Info Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-950/40 to-slate-900 border border-blue-800/40 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <h3 className="text-sm font-bold text-white">Datos en Tiempo Real (Barcelona - TMB iBus)</h3>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            TMB Oficial
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          La app está conectada en tiempo real a la API oficial de <strong>TMB (Transports Metropolitans de Barcelona)</strong> con toda la red de transporte en directo. No requiere claves de Madrid.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
            <div className="text-slate-400 text-[11px]">Proveedor Oficial</div>
            <div className="font-semibold text-white mt-0.5">TMB iBus (Barcelona)</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
            <div className="text-slate-400 text-[11px]">Red Conectada en Vivo</div>
            <div className="font-semibold text-emerald-400 mt-0.5">
              {lines.length} líneas · {stops.length} paradas
            </div>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
          <span>Servidor backend proxy activo</span>
          <span className="text-emerald-400 font-medium">100% Operativo</span>
        </div>
      </div>

      {/* Active Alerts List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            <span>Alertas activas en curso</span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-slate-700 text-slate-300 font-semibold">
              {alerts.length}
            </span>
          </h3>

          {alerts.length > 0 && (
            <button
              onClick={onClearAllAlerts}
              className="text-xs text-red-400 hover:text-red-300 font-medium"
            >
              Borrar todas
            </button>
          )}
        </div>

        {alerts.length === 0 ? (
          <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/50 text-center">
            <Bell className="w-8 h-8 mx-auto text-slate-500" />
            <p className="text-xs text-slate-400 mt-2">
              No tienes alertas programadas. Selecciona una parada o autobús en el mapa y presiona <strong>"Avisarme"</strong> para recibir una notificación automática cuando se aproxime.
            </p>
          </div>
        ) : (
          alerts.map((al) => (
            <div
              key={al.id}
              className="p-3.5 rounded-2xl bg-slate-800/90 border border-slate-700/80 flex items-center justify-between gap-3 shadow"
            >
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-black text-sm">
                  {al.lineCode}
                </span>

                <div>
                  <div className="text-sm font-bold text-white">
                    {al.stopName}
                  </div>
                  <div className="text-xs text-slate-400">
                    Avisar a &lt; {formatDistance(al.thresholdMeters)}
                    {al.lastDistance !== undefined && ` • Ahora a ${formatDistance(al.lastDistance)}`}
                  </div>
                </div>
              </div>

              <button
                onClick={() => onRemoveAlert(al.id)}
                className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Cancelar alerta"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
