/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  BusStop,
  BusLine,
  LiveBus,
  Arrival,
  FavoriteItem,
  ActiveAlert,
  UserPosition,
} from './types/transit';
import {
  generateNetworkForLocation,
  fetchTmbNetwork,
  stepSimulation,
  TransitNetwork,
  PRESET_HUBS,
  getTransitStatus,
  getRealtimeStopArrivals,
  TransitStatusResponse,
} from './services/transitData';
import {
  getStoredFavorites,
  saveFavorite,
  removeFavorite,
  getStoredAlerts,
  saveAlerts,
  getCachedNetwork,
  cacheNetworkLocally,
  getStoredSettings,
  saveStoredSettings,
  getStoredTheme,
  saveStoredTheme,
  UserSettings,
} from './services/storage';
import { sendProximityNotification } from './services/notificationService';
import { getDistanceMeters, formatDistance } from './utils/geo';

// Components
import { TransitMap } from './components/TransitMap';
import { StopDetailsSheet } from './components/StopDetailsSheet';
import { FavoritesView } from './components/FavoritesView';
import { RoutesListView } from './components/RoutesListView';
import { AlertsView } from './components/AlertsView';
import { Navbar } from './components/Navbar';
import { BottomNavigation, TabType } from './components/BottomNavigation';
import { LocationSelectorModal } from './components/LocationSelectorModal';
import { ProximityAlertBanner } from './components/ProximityAlertBanner';

// Icons
import { ListFilter, MapPin, Compass, Navigation, SlidersHorizontal, Check } from 'lucide-react';

export default function App() {
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => getStoredTheme() === 'dark');

  // Network State
  const [network, setNetwork] = useState<TransitNetwork>(() => {
    const cached = getCachedNetwork();
    if (cached && (cached.cityName.toLowerCase().includes('barcelona') || cached.cityName.toLowerCase().includes('tmb'))) {
      return cached;
    }
    // Default initial hub: Barcelona Pl. Catalunya
    return generateNetworkForLocation(41.3879, 2.1699, 'Barcelona - Pl. Catalunya / Rambles');
  });

  // Transit API Status
  const [transitStatus, setTransitStatus] = useState<TransitStatusResponse | null>(null);
  const [isLoadingTmbNetwork, setIsLoadingTmbNetwork] = useState(false);
  const [isRefreshingArrivals, setIsRefreshingArrivals] = useState(false);
  const [selectedStopLiveStatus, setSelectedStopLiveStatus] = useState<{
    isLive: boolean;
    provider: string;
    requiresCredentials?: boolean;
    invalidCredentials?: boolean;
    message?: string;
  } | null>(null);

  // Load full official TMB Barcelona network (all lines and stops in real time)
  useEffect(() => {
    let isCancelled = false;
    setIsLoadingTmbNetwork(true);

    fetchTmbNetwork(network.center[0], network.center[1], 'Barcelona - Red TMB Oficial')
      .then((fullNet) => {
        if (!isCancelled && fullNet.stops.length > 25) {
          setNetwork((prev) => ({
            ...fullNet,
            center: prev.center,
            cityName: prev.cityName && !prev.cityName.includes('Pl. Catalunya') ? prev.cityName : fullNet.cityName,
          }));
          cacheNetworkLocally(fullNet);
        }
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingTmbNetwork(false);
      });

    getTransitStatus().then((status) => {
      if (!isCancelled && status) setTransitStatus(status);
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  // User Location State
  const [userLocation, setUserLocation] = useState<UserPosition | null>(null);
  const [isRealGpsActive, setIsRealGpsActive] = useState(false);
  const [isGpsLoading, setIsGpsLoading] = useState(false);

  // Tab Navigation State
  const [activeTab, setActiveTab] = useState<TabType>('map');

  // Selection State
  const [selectedStop, setSelectedStop] = useState<BusStop | null>(null);
  const [selectedLine, setSelectedLine] = useState<BusLine | null>(null);
  const [showNearbyDrawer, setShowNearbyDrawer] = useState(false);
  const [showRadiusPopover, setShowRadiusPopover] = useState(false);
  const [nearbyOnlyInRadius, setNearbyOnlyInRadius] = useState(false);

  // Settings, Favorites & Alerts
  const [favorites, setFavorites] = useState<FavoriteItem[]>(() => getStoredFavorites());
  const [alerts, setAlerts] = useState<ActiveAlert[]>(() => getStoredAlerts());
  const [settings, setSettings] = useState<UserSettings>(() => getStoredSettings());
  const [bannerAlert, setBannerAlert] = useState<ActiveAlert | null>(null);

  // Connectivity
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  // Modals
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  // Watch position ID ref
  const watchIdRef = useRef<number | null>(null);

  // Sync theme with html class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    saveStoredTheme(isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Online / Offline Listeners
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Request & Watch GPS Geolocation
  const startGpsTracking = useCallback(() => {
    if (!('geolocation' in navigator)) {
      console.warn('Geolocation not supported in browser');
      return;
    }

    setIsGpsLoading(true);

    // Initial position
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy, heading, speed } = pos.coords;
        const newPos: UserPosition = {
          lat: latitude,
          lng: longitude,
          accuracy,
          heading,
          speed,
          timestamp: pos.timestamp,
          isSimulated: false,
        };

        setUserLocation(newPos);
        setIsRealGpsActive(true);
        setIsGpsLoading(false);

        // Center on user's real GPS position preserving all official TMB lines and stops
        setNetwork((prev) => ({
          ...prev,
          center: [latitude, longitude],
          cityName: 'Mi Ubicación Actual',
        }));
      },
      (err) => {
        console.warn('Geolocation initial query failed or denied:', err.message);
        setIsGpsLoading(false);
        // If GPS denied/unavailable, ensure user has simulated location centered on default hub
        if (!userLocation) {
          setUserLocation({
            lat: network.center[0],
            lng: network.center[1],
            accuracy: 18,
            heading: 45,
            speed: null,
            timestamp: Date.now(),
            isSimulated: true,
          });
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
    );

    // Continuous watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy, heading, speed } = pos.coords;
        setUserLocation({
          lat: latitude,
          lng: longitude,
          accuracy,
          heading,
          speed,
          timestamp: pos.timestamp,
          isSimulated: false,
        });
        setIsRealGpsActive(true);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 3000 }
    );
  }, [network.center, userLocation]);

  useEffect(() => {
    startGpsTracking();
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Real-time Simulation Engine Tick (~2.5s)
  useEffect(() => {
    const interval = setInterval(() => {
      setNetwork((prevNet) => {
        const stepped = stepSimulation(prevNet);

        // Evaluate proximity alerts
        if (userLocation && alerts.length > 0) {
          let updatedAlerts = [...alerts];
          let alertTriggeredThisTick: ActiveAlert | null = null;

          updatedAlerts = updatedAlerts.map((alert) => {
            if (alert.triggered) return alert;

            // Find matching bus on line
            const bus = stepped.buses.find(
              (b) => b.lineCode === alert.lineCode && (alert.busPlate ? b.plate === alert.busPlate : true)
            );
            const stop = stepped.stops.find((s) => s.id === alert.stopId);

            if (bus) {
              const distToUser = getDistanceMeters(bus.lat, bus.lng, userLocation.lat, userLocation.lng);
              const distToStop = stop ? getDistanceMeters(bus.lat, bus.lng, stop.lat, stop.lng) : distToUser;

              // Check if bus is closer than threshold to user or stop
              if (distToUser <= alert.thresholdMeters || distToStop <= alert.thresholdMeters) {
                // Trigger Alert!
                const triggeredAlert: ActiveAlert = {
                  ...alert,
                  triggered: true,
                  lastDistance: distToUser,
                };
                alertTriggeredThisTick = triggeredAlert;

                sendProximityNotification({
                  title: `🚌 ¡Autobús ${alert.lineCode} aproximándose!`,
                  body: `Llegará a ${alert.stopName}. Se encuentra a menos de ${formatDistance(
                    distToUser
                  )} de ti.`,
                  playSound: settings.soundEnabled,
                  vibrate: settings.vibrateEnabled,
                });

                return triggeredAlert;
              }

              return { ...alert, lastDistance: distToUser };
            }

            return alert;
          });

          if (alertTriggeredThisTick) {
            setBannerAlert(alertTriggeredThisTick);
          }

          saveAlerts(updatedAlerts);
          setAlerts(updatedAlerts);
        }

        // Cache periodically
        cacheNetworkLocally(stepped);
        return stepped;
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [userLocation, alerts, settings]);

  // Fetch real-time arrivals from TMB / Transit backend for a stop
  const fetchLiveArrivalsForStop = useCallback(async (stop: BusStop) => {
    setIsRefreshingArrivals(true);
    try {
      const res = await getRealtimeStopArrivals(stop.code);
      setSelectedStopLiveStatus({
        isLive: res.isLive,
        provider: res.provider,
        requiresCredentials: res.requiresCredentials,
        invalidCredentials: res.invalidCredentials,
        message: res.message,
      });

      const arrivals = res.arrivals || [];
      setSelectedStop((prev) => (prev && prev.id === stop.id ? { ...prev, nextArrivals: arrivals } : prev));
      setNetwork((prev) => ({
        ...prev,
        stops: prev.stops.map((s) => (s.id === stop.id ? { ...s, nextArrivals: arrivals } : s)),
      }));
    } catch (err) {
      console.warn('Could not refresh live arrivals:', err);
    } finally {
      setIsRefreshingArrivals(false);
    }
  }, []);

  const handleSelectStop = useCallback((stop: BusStop) => {
    setSelectedStop(stop);
    setSelectedLine(null);
    setShowNearbyDrawer(false);
    fetchLiveArrivalsForStop(stop);
  }, [fetchLiveArrivalsForStop]);

  // Keep selected stop updated with latest real-time arrivals
  useEffect(() => {
    if (selectedStop) {
      const refreshed = network.stops.find((s) => s.id === selectedStop.id);
      if (refreshed) {
        setSelectedStop(refreshed);
      }
    }
  }, [network.stops]);

  // Favorite Handlers
  const handleToggleFavoriteStop = (stop: BusStop) => {
    const item: FavoriteItem = {
      id: `fav-stop-${stop.id}`,
      type: 'stop',
      stopId: stop.id,
      stopName: stop.name,
      stopCode: stop.code,
      savedAt: Date.now(),
    };
    const updated = saveFavorite(item);
    setFavorites(updated);
  };

  const handleToggleRouteFavorite = (line: BusLine) => {
    const item: FavoriteItem = {
      id: `fav-route-${line.code}`,
      type: 'route',
      lineCode: line.code,
      lineName: line.name,
      lineColor: line.color,
      destination: line.destination,
      savedAt: Date.now(),
    };
    const updated = saveFavorite(item);
    setFavorites(updated);
  };

  const handleRemoveFavorite = (favId: string) => {
    const updated = removeFavorite(favId);
    setFavorites(updated);
  };

  // Alert Handlers
  const handleToggleArrivalAlert = (arrival: Arrival) => {
    if (!selectedStop) return;

    const existingAlertIndex = alerts.findIndex(
      (a) => a.stopId === selectedStop.id && a.lineCode === arrival.lineCode
    );

    let updatedAlerts: ActiveAlert[];

    if (existingAlertIndex >= 0) {
      // Remove alert
      updatedAlerts = alerts.filter((_, idx) => idx !== existingAlertIndex);
    } else {
      // Add new active proximity alert
      const newAlert: ActiveAlert = {
        id: `alert-${selectedStop.id}-${arrival.lineCode}-${Date.now()}`,
        stopId: selectedStop.id,
        stopName: selectedStop.name,
        lineCode: arrival.lineCode,
        busPlate: arrival.busPlate,
        thresholdMeters: settings.alertThresholdMeters,
        thresholdMinutes: settings.alertThresholdMinutes,
        createdTime: Date.now(),
        triggered: false,
        lastDistance: arrival.distanceMeters,
      };
      updatedAlerts = [newAlert, ...alerts];

      // Give quick confirmation
      sendProximityNotification({
        title: `🔔 Alerta activada: Línea ${arrival.lineCode}`,
        body: `Te avisaremos cuando el autobús esté a menos de ${formatDistance(
          settings.alertThresholdMeters
        )} de tu ubicación actual.`,
        playSound: settings.soundEnabled,
        vibrate: settings.vibrateEnabled,
      });
    }

    setAlerts(updatedAlerts);
    saveAlerts(updatedAlerts);
  };

  const handleRemoveAlert = (alertId: string) => {
    const updated = alerts.filter((a) => a.id !== alertId);
    setAlerts(updated);
    saveAlerts(updated);
  };

  const handleClearAllAlerts = () => {
    setAlerts([]);
    saveAlerts([]);
  };

  const handleUpdateSettings = (newSettings: UserSettings) => {
    setSettings(newSettings);
    saveStoredSettings(newSettings);
  };

  // Location presets or manual selection
  const handleSelectPreset = (name: string, coords: [number, number]) => {
    setUserLocation({
      lat: coords[0],
      lng: coords[1],
      accuracy: 20,
      heading: null,
      speed: null,
      timestamp: Date.now(),
      isSimulated: true,
    });
    setIsRealGpsActive(false);

    setNetwork((prev) => ({
      ...prev,
      center: coords,
      cityName: name,
    }));
    setSelectedStop(null);
    setSelectedLine(null);
  };

  const handleManualMapLocation = (lat: number, lng: number) => {
    setUserLocation({
      lat,
      lng,
      accuracy: 25,
      heading: null,
      speed: null,
      timestamp: Date.now(),
      isSimulated: true,
    });
    setIsRealGpsActive(false);

    setNetwork((prev) => ({
      ...prev,
      center: [lat, lng],
      cityName: 'Ubicación en Mapa',
    }));
  };

  // Recenter GPS
  const handleRecenter = () => {
    startGpsTracking();
  };

  // Reference coordinates for distance calculations: user location or map center
  const originLat = userLocation?.lat ?? network.center[0];
  const originLng = userLocation?.lng ?? network.center[1];

  // Sorted stops by distance to user / center
  const sortedStops = useMemo(() => {
    return [...network.stops]
      .map((s) => {
        const dist = getDistanceMeters(originLat, originLng, s.lat, s.lng);
        return { ...s, distanceToUser: dist };
      })
      .sort((a, b) => a.distanceToUser - b.distanceToUser);
  }, [network.stops, originLat, originLng]);

  // Stops within configured search radius
  const stopsWithinRadius = useMemo(() => {
    return sortedStops.filter((s) => s.distanceToUser <= settings.searchRadiusMeters);
  }, [sortedStops, settings.searchRadiusMeters]);

  const displayedNearbyStops = nearbyOnlyInRadius ? stopsWithinRadius : sortedStops;

  const isStopFavorite = selectedStop
    ? favorites.some((f) => f.type === 'stop' && (f.stopId === selectedStop.id || f.stopCode === selectedStop.code))
    : false;

  const userDistanceToSelectedStop =
    selectedStop && userLocation
      ? getDistanceMeters(userLocation.lat, userLocation.lng, selectedStop.lat, selectedStop.lng)
      : undefined;

  return (
    <div
      id="bustiempo-app"
      className={`relative w-full h-screen overflow-hidden flex flex-col font-sans ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* Top Android App Bar */}
      <Navbar
        cityName={network.cityName}
        isDarkMode={isDarkMode}
        isOffline={isOffline}
        isGpsActive={isRealGpsActive}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        onOpenLocationModal={() => setIsLocationModalOpen(true)}
        onRequestGPS={startGpsTracking}
        providerLabel={
          isLoadingTmbNetwork
            ? 'Cargando TMB...'
            : `${network.lines.length} líneas · ${network.stops.length} paradas`
        }
      />

      {/* Floating Proximity Alert Banner */}
      <ProximityAlertBanner
        alert={bannerAlert}
        onDismiss={() => setBannerAlert(null)}
        onViewOnMap={() => {
          if (bannerAlert) {
            const stop = network.stops.find((s) => s.id === bannerAlert.stopId);
            if (stop) {
              handleSelectStop(stop);
              setActiveTab('map');
            }
          }
          setBannerAlert(null);
        }}
      />

      {/* Main Screen Content Area */}
      <main className="relative flex-1 w-full h-[calc(100vh-3.5rem-4rem)] overflow-hidden">
        {/* Tab 1: Map View */}
        {activeTab === 'map' && (
          <div className="relative w-full h-full">
            {/* Fullscreen Map */}
            <TransitMap
              center={network.center}
              userLocation={userLocation}
              stops={network.stops}
              lines={network.lines}
              buses={network.buses}
              selectedStop={selectedStop}
              selectedLine={selectedLine}
              onSelectStop={handleSelectStop}
              isDarkMode={isDarkMode}
              searchRadius={settings.searchRadiusMeters}
              onRecenter={handleRecenter}
              onManualLocationSelect={handleManualMapLocation}
            />

            {/* Floating Top Controls: Radius & Nearby Bar */}
            <div className="absolute top-4 right-4 z-[400] flex items-center gap-2">
              {/* Quick Search Radius Selector Button & Popover */}
              <div className="relative">
                <button
                  id="btn-toggle-radius-modal"
                  onClick={() => {
                    setShowRadiusPopover(!showRadiusPopover);
                    setShowNearbyDrawer(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-bold shadow-xl active:scale-95 transition-all ${
                    showRadiusPopover
                      ? 'bg-blue-600 text-white border-blue-400'
                      : 'bg-slate-900/90 hover:bg-slate-800 text-blue-300 border-slate-700/80'
                  }`}
                  title="Configurar radio de búsqueda"
                >
                  <Compass className="w-3.5 h-3.5 text-blue-400" />
                  <span>Radio: {formatDistance(settings.searchRadiusMeters)}</span>
                </button>

                {/* Floating Radius Popover */}
                {showRadiusPopover && (
                  <div
                    id="radius-popover"
                    className="absolute top-10 right-0 w-72 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-4 shadow-2xl z-[460] space-y-3 animate-in fade-in zoom-in-95 duration-150"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                        <Compass className="w-4 h-4 text-blue-400" />
                        <span>Radio de Búsqueda</span>
                      </div>
                      <button
                        onClick={() => setShowRadiusPopover(false)}
                        className="text-xs text-slate-400 hover:text-white"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Distancia actual:</span>
                      <span className="font-bold text-blue-400 text-sm">
                        {formatDistance(settings.searchRadiusMeters)}
                      </span>
                    </div>

                    {/* Quick presets */}
                    <div className="grid grid-cols-3 gap-1.5">
                      {[300, 500, 800, 1000, 1500, 2500].map((dist) => (
                        <button
                          key={dist}
                          onClick={() => {
                            handleUpdateSettings({ ...settings, searchRadiusMeters: dist });
                          }}
                          className={`py-1.5 px-1 text-[11px] font-semibold rounded-lg border transition-all ${
                            settings.searchRadiusMeters === dist
                              ? 'bg-blue-600 text-white border-blue-400 font-bold'
                              : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-slate-600'
                          }`}
                        >
                          {formatDistance(dist)}
                        </button>
                      ))}
                    </div>

                    {/* Slider */}
                    <div className="space-y-1 pt-1">
                      <input
                        type="range"
                        min="100"
                        max="5000"
                        step="50"
                        value={settings.searchRadiusMeters}
                        onChange={(e) =>
                          handleUpdateSettings({ ...settings, searchRadiusMeters: Number(e.target.value) })
                        }
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>100 m</span>
                        <span>1 km</span>
                        <span>5 km</span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800 text-center">
                      <span className="text-emerald-400 font-bold">{stopsWithinRadius.length}</span> de {network.stops.length} paradas en este radio
                    </div>
                  </div>
                )}
              </div>

              {/* Nearby Stops Drawer Toggle Button */}
              <button
                id="btn-toggle-nearby-drawer"
                onClick={() => {
                  setShowNearbyDrawer(!showNearbyDrawer);
                  setShowRadiusPopover(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md border border-slate-700/80 text-xs font-bold text-white shadow-xl active:scale-95 transition-all"
              >
                <ListFilter className="w-3.5 h-3.5 text-blue-400" />
                <span>Paradas ({stopsWithinRadius.length})</span>
              </button>
            </div>

            {/* Quick Nearby Stops Drawer Overlay */}
            {showNearbyDrawer && (
              <div
                id="nearby-stops-overlay"
                className="absolute top-14 right-4 w-80 max-w-[calc(100vw-2rem)] max-h-[65vh] bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-4 shadow-2xl z-[450] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-blue-400" />
                    <span className="font-bold text-xs text-white">Paradas Cercanas</span>
                  </div>
                  <button
                    onClick={() => setShowNearbyDrawer(false)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                {/* Filter toggle by search radius */}
                <div className="flex items-center justify-between py-2 border-b border-slate-800 text-xs">
                  <span className="text-slate-400 text-[11px]">
                    Radio: <strong className="text-blue-300">{formatDistance(settings.searchRadiusMeters)}</strong>
                  </span>
                  <button
                    onClick={() => setNearbyOnlyInRadius(!nearbyOnlyInRadius)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-all ${
                      nearbyOnlyInRadius
                        ? 'bg-blue-600/30 text-blue-300 border-blue-500/50'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {nearbyOnlyInRadius ? `Solo en radio (${stopsWithinRadius.length})` : `Mostrar todas (${sortedStops.length})`}
                  </button>
                </div>

                <div className="overflow-y-auto space-y-2 mt-2 pr-1">
                  {displayedNearbyStops.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400">
                      No hay paradas dentro de {formatDistance(settings.searchRadiusMeters)}.
                      <div className="mt-2">
                        <button
                          onClick={() => handleUpdateSettings({ ...settings, searchRadiusMeters: 2500 })}
                          className="px-3 py-1 rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/30 font-semibold"
                        >
                          Ampliar radio a 2.5 km
                        </button>
                      </div>
                    </div>
                  ) : (
                    displayedNearbyStops.map((stop) => {
                      const isInside = stop.distanceToUser <= settings.searchRadiusMeters;
                      return (
                        <div
                          key={stop.id}
                          onClick={() => {
                            handleSelectStop(stop);
                          }}
                          className={`p-2.5 rounded-xl border cursor-pointer transition-colors flex items-center justify-between gap-2 ${
                            isInside
                              ? 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700/60'
                              : 'bg-slate-900/60 hover:bg-slate-800/60 border-slate-800/60 opacity-60'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">
                              {stop.name}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <span className="text-amber-400 font-semibold">#{stop.code}</span>
                              <span>•</span>
                              <span>Líneas: {stop.lines.join(', ')}</span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-xs font-bold text-blue-400">
                              {formatDistance(stop.distanceToUser)}
                            </span>
                            {stop.nextArrivals[0] && (
                              <div className="text-[10px] text-emerald-400 font-semibold">
                                {Math.ceil(stop.nextArrivals[0].etaSeconds / 60)} min
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Selected Stop Details Bottom Sheet */}
            {selectedStop && (
              <StopDetailsSheet
                stop={selectedStop}
                lines={network.lines}
                userDistanceMeters={userDistanceToSelectedStop}
                isFavorite={isStopFavorite}
                activeAlerts={alerts}
                onToggleFavorite={() => handleToggleFavoriteStop(selectedStop)}
                onToggleAlert={handleToggleArrivalAlert}
                onSelectLine={(line) => setSelectedLine(line)}
                onClose={() => setSelectedStop(null)}
                isOffline={isOffline}
                onRefreshLive={() => selectedStop && fetchLiveArrivalsForStop(selectedStop)}
                isRefreshing={isRefreshingArrivals}
                liveStatus={selectedStopLiveStatus}
              />
            )}
          </div>
        )}

        {/* Tab 2: Routes List View */}
        {activeTab === 'routes' && (
          <RoutesListView
            lines={network.lines}
            stops={network.stops}
            buses={network.buses}
            favorites={favorites}
            onSelectLine={(line) => {
              setSelectedLine(line);
              setSelectedStop(null);
              setActiveTab('map');
            }}
            onSelectStop={(stop) => {
              handleSelectStop(stop);
              setActiveTab('map');
            }}
            onToggleRouteFavorite={handleToggleRouteFavorite}
          />
        )}

        {/* Tab 3: Favorites View */}
        {activeTab === 'favorites' && (
          <FavoritesView
            favorites={favorites}
            stops={network.stops}
            lines={network.lines}
            userLat={userLocation?.lat}
            userLng={userLocation?.lng}
            onSelectStop={(stop) => {
              handleSelectStop(stop);
              setActiveTab('map');
            }}
            onSelectLine={(line) => {
              setSelectedLine(line);
              setSelectedStop(null);
              setActiveTab('map');
            }}
            onRemoveFavorite={handleRemoveFavorite}
            onAddStopFavorite={handleToggleFavoriteStop}
            isOffline={isOffline}
          />
        )}

        {/* Tab 4: Alerts Manager View */}
        {activeTab === 'alerts' && (
          <AlertsView
            alerts={alerts}
            stops={network.stops}
            lines={network.lines}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onRemoveAlert={handleRemoveAlert}
            onClearAllAlerts={handleClearAllAlerts}
          />
        )}
      </main>

      {/* Bottom Android Navigation Bar */}
      <BottomNavigation
        activeTab={activeTab}
        onChangeTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'map') {
            setShowNearbyDrawer(false);
          }
        }}
        favoritesCount={favorites.length}
        activeAlertsCount={alerts.filter((a) => !a.triggered).length}
      />

      {/* Location / City Selector Modal */}
      <LocationSelectorModal
        currentCityName={network.cityName}
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onSelectPreset={handleSelectPreset}
        onRequestRealGPS={startGpsTracking}
        isRealGpsActive={isRealGpsActive}
      />
    </div>
  );
}
