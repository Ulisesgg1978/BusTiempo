/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { ListFilter, MapPin, Compass, Navigation } from 'lucide-react';

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
  const [isRefreshingArrivals, setIsRefreshingArrivals] = useState(false);

  // Load transit provider status on boot
  useEffect(() => {
    getTransitStatus().then((status) => {
      if (status) setTransitStatus(status);
    });
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

        // Procedurally populate transit stops around user's real location!
        setNetwork((prev) => {
          const updated = generateNetworkForLocation(latitude, longitude, 'Mi Ubicación Actual');
          cacheNetworkLocally(updated);
          return updated;
        });
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
      const liveArrivals = await getRealtimeStopArrivals(stop.code);
      if (liveArrivals && liveArrivals.length > 0) {
        setSelectedStop((prev) => (prev && prev.id === stop.id ? { ...prev, nextArrivals: liveArrivals } : prev));
        setNetwork((prev) => ({
          ...prev,
          stops: prev.stops.map((s) => (s.id === stop.id ? { ...s, nextArrivals: liveArrivals } : s)),
        }));
      }
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

    const newNet = generateNetworkForLocation(coords[0], coords[1], name);
    setNetwork(newNet);
    cacheNetworkLocally(newNet);
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

    const newNet = generateNetworkForLocation(lat, lng, 'Ubicación en Mapa');
    setNetwork(newNet);
    cacheNetworkLocally(newNet);
  };

  // Recenter GPS
  const handleRecenter = () => {
    startGpsTracking();
  };

  // Sorted stops by distance to user
  const sortedStops = [...network.stops].map((s) => {
    const dist = userLocation
      ? getDistanceMeters(userLocation.lat, userLocation.lng, s.lat, s.lng)
      : 9999;
    return { ...s, distanceToUser: dist };
  }).sort((a, b) => a.distanceToUser - b.distanceToUser);

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
        providerLabel={network.cityName.toLowerCase().includes('barcelona') ? 'TMB Barcelona' : 'España'}
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

            {/* Floating Top Filter & Quick Nearby Bar */}
            <div className="absolute top-4 right-4 z-[400] flex items-center gap-2">
              <button
                id="btn-toggle-nearby-drawer"
                onClick={() => setShowNearbyDrawer(!showNearbyDrawer)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md border border-slate-700/80 text-xs font-bold text-white shadow-xl active:scale-95 transition-all"
              >
                <ListFilter className="w-3.5 h-3.5 text-blue-400" />
                <span>Paradas cercanas ({sortedStops.length})</span>
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
                    <span className="font-bold text-xs text-white">Ordenadas por distancia</span>
                  </div>
                  <button
                    onClick={() => setShowNearbyDrawer(false)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <div className="overflow-y-auto space-y-2 mt-2 pr-1">
                  {sortedStops.map((stop) => (
                    <div
                      key={stop.id}
                      onClick={() => {
                        handleSelectStop(stop);
                      }}
                      className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 cursor-pointer transition-colors flex items-center justify-between gap-2"
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
                  ))}
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
