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
  TargetPoint,
  RecentDestination,
  DestinationFavorite,
  MatchStopRole,
  MatchedLineETA,
  TransitTransferSuggestion,
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
  getStoredRecentDestinations,
  saveRecentDestination,
  getStoredDestinationFavorites,
  saveDestinationFavorite,
  removeDestinationFavorite,
  loadCachedNetworkFromIDB,
} from './services/storage';
import {
  sendProximityNotification,
  triggerBackgroundTestNotification,
  requestNotificationPermission,
} from './services/notificationService';
import { getDistanceMeters, formatDistance } from './utils/geo';
import {
  computeStopMatchRoles,
  computeMatchedLineETAs,
  computeTransferSuggestions,
  filterClosestStopsForMatchedLines,
} from './services/transitMatching';

// Components
import { TransitMap } from './components/TransitMap';
import { StopDetailsSheet } from './components/StopDetailsSheet';
import { FavoritesView } from './components/FavoritesView';
import { RoutesListView } from './components/RoutesListView';
import { AlertsView } from './components/AlertsView';
import { Navbar, VehicleDisplayMode } from './components/Navbar';
import { BottomNavigation, TabType } from './components/BottomNavigation';
import { LocationSelectorModal } from './components/LocationSelectorModal';
import { ProximityAlertBanner } from './components/ProximityAlertBanner';
import { DestinationMenu } from './components/DestinationMenu';
import { QuickFavoriteDestinations } from './components/QuickFavoriteDestinations';
import { AddressSearchModal } from './components/AddressSearchModal';
import { NearbyFavoriteStopsModal } from './components/NearbyFavoriteStopsModal';

// Icons
import {
  ListFilter,
  MapPin,
  Compass,
  Navigation,
  SlidersHorizontal,
  Check,
  Bus,
  Crosshair,
  Sparkles,
  X,
  Target,
  ArrowRight,
  Route,
  Clock,
  Shuffle,
  Star,
  ChevronDown,
  WifiOff,
  Bell,
  Radio,
  Search,
} from 'lucide-react';

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

  // Target Destination Point State (Second zone with matching radius & line matching)
  const [destinationPoint, setDestinationPoint] = useState<TargetPoint | null>(() => {
    try {
      const stored = localStorage.getItem('bustiempo_destination_point');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [isSettingDestination, setIsSettingDestination] = useState<boolean>(false);
  const [isDestinationMenuOpen, setIsDestinationMenuOpen] = useState<boolean>(false);
  const [isMatchCardCollapsed, setIsMatchCardCollapsed] = useState<boolean>(false);
  const [isMatchCardClosed, setIsMatchCardClosed] = useState<boolean>(false);
  const [showBuses, setShowBuses] = useState<boolean>(true);
  const [vehicleDisplayMode, setVehicleDisplayMode] = useState<VehicleDisplayMode>('in_radius');
  const handleCycleVehicleMode = () => {
    setVehicleDisplayMode((prev) => {
      if (prev === 'in_radius') return 'all';
      if (prev === 'all') return 'none';
      return 'in_radius';
    });
  };
  const [showStops, setShowStops] = useState<boolean>(true);
  const [isNearbyFavoriteStopsOpen, setIsNearbyFavoriteStopsOpen] = useState<boolean>(false);
  const [isAddressSearchOpen, setIsAddressSearchOpen] = useState<boolean>(false);
  const [explorePoint, setExplorePoint] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [recentDestinations, setRecentDestinations] = useState<RecentDestination[]>(() =>
    getStoredRecentDestinations()
  );
  const [favoriteDestinations, setFavoriteDestinations] = useState<DestinationFavorite[]>(() =>
    getStoredDestinationFavorites()
  );
  const [selectedTransfer, setSelectedTransfer] = useState<TransitTransferSuggestion | null>(null);

  // Check if active destination is already saved in favorites
  const isDestinationInFavorites = useMemo(() => {
    if (!destinationPoint) return false;
    return favoriteDestinations.some(
      (f) => Math.hypot(f.lat - destinationPoint.lat, f.lng - destinationPoint.lng) < 0.0004
    );
  }, [destinationPoint, favoriteDestinations]);

  // Save destination point to local storage
  useEffect(() => {
    try {
      if (destinationPoint) {
        localStorage.setItem('bustiempo_destination_point', JSON.stringify(destinationPoint));
      } else {
        localStorage.removeItem('bustiempo_destination_point');
      }
    } catch {
      // ignore
    }
  }, [destinationPoint]);

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

  const handleSelectLine = useCallback((line: BusLine) => {
    setSelectedLine(line);
    setSelectedStop(null);
  }, []);

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

  // Set destination point from map click or menu selection
  const handleSetDestinationPoint = (lat: number, lng: number, name = 'Zona Destino') => {
    const point = {
      lat,
      lng,
      name,
    };
    setDestinationPoint(point);
    setIsSettingDestination(false);
    setSelectedStop(null); // Prevent overlapping stop details sheet
    setShowNearbyDrawer(false); // Close drawer to avoid clutter
    setShowRadiusPopover(false); // Close radius popover
    setSelectedTransfer(null);
    setIsMatchCardCollapsed(false);
    setIsMatchCardClosed(false);
    const updatedRecents = saveRecentDestination(point);
    setRecentDestinations(updatedRecents);
  };

  const handleAddDestinationFavorite = (fav: DestinationFavorite) => {
    const updated = saveDestinationFavorite(fav);
    setFavoriteDestinations(updated);
  };

  const handleRemoveDestinationFavorite = (favId: string) => {
    const updated = removeDestinationFavorite(favId);
    setFavoriteDestinations(updated);
  };

  // Clear destination point
  const handleClearDestinationPoint = () => {
    setDestinationPoint(null);
    setIsSettingDestination(false);
    setSelectedTransfer(null);
    setIsMatchCardCollapsed(false);
    setIsMatchCardClosed(false);
    if (settings.busFilterMode === 'matches_only') {
      handleUpdateSettings({ ...settings, busFilterMode: 'in_radius' });
    }
  };

  // Reference coordinates for distance calculations: user location or map center
  const originLat = userLocation?.lat ?? network.center[0];
  const originLng = userLocation?.lng ?? network.center[1];

  // Sorted stops by distance to user / center (Origin zone)
  const sortedStops = useMemo(() => {
    return [...network.stops]
      .map((s) => {
        const dist = getDistanceMeters(originLat, originLng, s.lat, s.lng);
        return { ...s, distanceToUser: dist };
      })
      .sort((a, b) => a.distanceToUser - b.distanceToUser);
  }, [network.stops, originLat, originLng]);

  // Stops within configured search radius (Origin zone)
  const stopsWithinRadius = useMemo(() => {
    return sortedStops.filter((s) => s.distanceToUser <= settings.searchRadiusMeters);
  }, [sortedStops, settings.searchRadiusMeters]);

  // Stops within configured destination radius (Destination zone with IDENTICAL radius)
  const stopsWithinDestRadius = useMemo(() => {
    if (!destinationPoint) return [];
    return network.stops.filter((s) => {
      const dist = getDistanceMeters(destinationPoint.lat, destinationPoint.lng, s.lat, s.lng);
      return dist <= settings.searchRadiusMeters;
    });
  }, [network.stops, destinationPoint, settings.searchRadiusMeters]);

  // Distance between Origin and Destination points
  const distanceOriginToDest = useMemo(() => {
    if (!destinationPoint) return null;
    return getDistanceMeters(originLat, originLng, destinationPoint.lat, destinationPoint.lng);
  }, [destinationPoint, originLat, originLng]);

  // Lines that pass through stops inside the Origin radius
  const linesServingRadius = useMemo(() => {
    const lineCodes = new Set<string>();
    stopsWithinRadius.forEach((s) => {
      s.lines.forEach((l) => lineCodes.add(l.toUpperCase()));
    });
    network.lines.forEach((l) => {
      if (
        l.stops &&
        l.stops.some((sId) => stopsWithinRadius.some((s) => s.id === sId || s.code === sId))
      ) {
        lineCodes.add(l.code.toUpperCase());
      }
    });
    return lineCodes;
  }, [stopsWithinRadius, network.lines]);

  // Lines that pass through stops inside the Destination radius
  const linesServingDest = useMemo(() => {
    if (!destinationPoint) return new Set<string>();
    const lineCodes = new Set<string>();
    stopsWithinDestRadius.forEach((s) => {
      s.lines.forEach((l) => lineCodes.add(l.toUpperCase()));
    });
    network.lines.forEach((l) => {
      if (
        l.stops &&
        l.stops.some((sId) => stopsWithinDestRadius.some((s) => s.id === sId || s.code === sId))
      ) {
        lineCodes.add(l.code.toUpperCase());
      }
    });
    return lineCodes;
  }, [stopsWithinDestRadius, network.lines, destinationPoint]);

  // Matched Line Codes: lines that pass through BOTH Origin radius AND Destination radius!
  const matchedLineCodes = useMemo(() => {
    if (!destinationPoint) return new Set<string>();
    const matches = new Set<string>();
    for (const code of linesServingRadius) {
      if (linesServingDest.has(code)) {
        matches.add(code);
      }
    }
    return matches;
  }, [destinationPoint, linesServingRadius, linesServingDest]);

  // Full BusLine objects for matched lines
  const matchedLines = useMemo(() => {
    return network.lines.filter((l) => matchedLineCodes.has(l.code.toUpperCase()));
  }, [network.lines, matchedLineCodes]);

  // Directional stop roles (IDA in Emerald, VUELTA in Rose, DUAL in Amber)
  const stopMatchRoles = useMemo(() => {
    return computeStopMatchRoles(stopsWithinRadius, stopsWithinDestRadius, matchedLines, network.stops);
  }, [stopsWithinRadius, stopsWithinDestRadius, matchedLines, network.stops]);

  // Dynamic estimated arrival times (ETAs) at the matched stops
  // Requirement 4: Calculate door-to-door arrival time (walk to origin stop + wait time + transit time + walk from dest stop to destination)
  // and sort matched lines by fastest total arrival time
  const matchedLineETAs = useMemo(() => {
    return computeMatchedLineETAs(
      matchedLines,
      stopsWithinRadius,
      stopsWithinDestRadius,
      network.buses,
      stopMatchRoles,
      originLat,
      originLng,
      destinationPoint?.lat ?? originLat,
      destinationPoint?.lng ?? originLng
    );
  }, [
    matchedLines,
    stopsWithinRadius,
    stopsWithinDestRadius,
    network.buses,
    stopMatchRoles,
    originLat,
    originLng,
    destinationPoint,
  ]);

  // Requirement 6: When in match mode, keep ONLY the single closest stop for IDA and single closest stop for VUELTA per line
  const allowedMatchStopIds = useMemo(() => {
    if (!destinationPoint || matchedLines.length === 0) return undefined;
    return filterClosestStopsForMatchedLines(
      network.stops,
      matchedLines,
      stopMatchRoles,
      originLat,
      originLng,
      destinationPoint.lat,
      destinationPoint.lng
    );
  }, [destinationPoint, matchedLines, stopMatchRoles, network.stops, originLat, originLng]);

  // Transit transfer suggestions when no direct match is found
  const transferSuggestions = useMemo(() => {
    if (!destinationPoint || matchedLines.length > 0) return [];
    return computeTransferSuggestions(
      network,
      stopsWithinRadius,
      stopsWithinDestRadius,
      originLat,
      originLng,
      destinationPoint.lat,
      destinationPoint.lng
    );
  }, [destinationPoint, matchedLines.length, network, stopsWithinRadius, stopsWithinDestRadius, originLat, originLng]);

  // Highlighted transfer stops on the map when a transfer suggestion is selected
  const highlightedTransferStopIds = useMemo(() => {
    if (!selectedTransfer) return undefined;
    return new Set([
      selectedTransfer.firstStop.id,
      selectedTransfer.transferStopFirst.id,
      selectedTransfer.transferStopSecond.id,
      selectedTransfer.destStop.id,
    ]);
  }, [selectedTransfer]);

  // Buses to display based on setting: 'none' (sin vehículos) vs 'in_radius' (paradas del radio de acción) vs 'all' (todos)
  const displayedBuses = useMemo(() => {
    if (vehicleDisplayMode === 'none') {
      return [];
    }

    // 1. Tag each bus with whether it connects Origin & Destination (Match)
    const taggedBuses = network.buses.map((bus) => {
      const codeUpper = bus.lineCode.toUpperCase();
      const isMatch = matchedLineCodes.has(codeUpper);
      return {
        ...bus,
        isMatch,
      };
    });

    if (vehicleDisplayMode === 'all') {
      return taggedBuses;
    }

    // Default 'in_radius': buses that serve Origin zone OR Destination zone (if set), or selected
    return taggedBuses.filter((bus) => {
      const codeUpper = bus.lineCode.toUpperCase();
      const servesOrigin = linesServingRadius.has(codeUpper);
      const servesDest = destinationPoint ? linesServingDest.has(codeUpper) : false;
      const isSelectedLine = selectedLine && selectedLine.code.toUpperCase() === codeUpper;
      const servesSelectedStop =
        selectedStop && selectedStop.lines.some((l) => l.toUpperCase() === codeUpper);
      const servesTransfer =
        selectedTransfer &&
        (selectedTransfer.firstLine.code.toUpperCase() === codeUpper ||
          selectedTransfer.secondLine.code.toUpperCase() === codeUpper);

      return servesOrigin || servesDest || isSelectedLine || servesSelectedStop || servesTransfer;
    });
  }, [
    network.buses,
    vehicleDisplayMode,
    linesServingRadius,
    linesServingDest,
    destinationPoint,
    matchedLineCodes,
    selectedLine,
    selectedStop,
    selectedTransfer,
  ]);

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
        isDarkMode={isDarkMode}
        isOffline={isOffline}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        onOpenDestination={() => {
          setIsDestinationMenuOpen(true);
          setIsMatchCardClosed(false);
          setIsMatchCardCollapsed(false);
        }}
        hasDestination={Boolean(destinationPoint)}
        destinationName={destinationPoint?.name}
        vehicleDisplayMode={vehicleDisplayMode}
        onCycleVehicleMode={handleCycleVehicleMode}
        searchRadiusMeters={settings.searchRadiusMeters}
        onOpenRadius={() => setShowRadiusPopover(true)}
        showStops={showStops}
        onToggleStops={() => setShowStops((prev) => !prev)}
        onOpenAddressSearch={() => setIsAddressSearchOpen(true)}
        providerLabel="TMB · AMB · Renfe · FGC"
      />

      {/* Quick Favorite Destinations (Casa, Trabajo, Gym, Favorito - aligned to left horizontally) */}
      <QuickFavoriteDestinations
        currentDestination={destinationPoint}
        onSelectDestination={(lat, lng, name) => {
          handleSetDestinationPoint(lat, lng, name);
          setIsMatchCardClosed(false);
          setIsMatchCardCollapsed(false);
        }}
        userLocationLat={userLocation?.lat}
        userLocationLng={userLocation?.lng}
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
              buses={displayedBuses}
              selectedStop={selectedStop}
              selectedLine={selectedLine}
              onSelectStop={handleSelectStop}
              isDarkMode={isDarkMode}
              searchRadius={settings.searchRadiusMeters}
              onRecenter={handleRecenter}
              onManualLocationSelect={handleManualMapLocation}
              destinationPoint={destinationPoint}
              onSetDestinationPoint={handleSetDestinationPoint}
              onClearDestinationPoint={handleClearDestinationPoint}
              isSettingDestination={isSettingDestination}
              matchedLineCodes={matchedLineCodes}
              stopMatchRoles={stopMatchRoles}
              highlightedTransferStopIds={highlightedTransferStopIds}
              selectedTransfer={selectedTransfer}
              allowedMatchStopIds={allowedMatchStopIds}
              matchedLineETAs={matchedLineETAs}
              showBuses={vehicleDisplayMode !== 'none'}
              showStops={showStops}
              explorePoint={explorePoint}
              onOpenFavoriteStops={() => setIsNearbyFavoriteStopsOpen(true)}
            />

            {/* Botón de Paradas recuperado bajo la barra superior */}
            <div className="absolute top-3 right-4 z-[410]">
              <button
                id="btn-toggle-nearby-drawer"
                onClick={() => setShowNearbyDrawer((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-bold shadow-xl active:scale-95 transition-all ${
                  showNearbyDrawer
                    ? 'bg-emerald-600 border-emerald-400 text-white ring-2 ring-emerald-500/50 shadow-emerald-900/30'
                    : 'bg-slate-900/90 border-slate-700/80 hover:bg-slate-800 text-slate-200'
                }`}
                title="Abrir panel de paradas cercanas con tiempos de llegada"
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Paradas</span>
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold border border-emerald-500/30">
                  {stopsWithinRadius.length}
                </span>
              </button>
            </div>

            {/* Offline Status Guide Banner */}
            {isOffline && !isSettingDestination && (
              <div className="absolute top-16 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-auto z-[450] animate-in fade-in duration-200 pointer-events-auto">
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/95 backdrop-blur-md text-amber-300 font-bold text-xs shadow-xl border border-amber-500/50">
                  <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Modo sin conexión · {network.stops.length} paradas y {network.lines.length} rutas cargadas en memoria</span>
                </div>
              </div>
            )}

            {/* Unified Top Banner when Setting Destination Point (No overlap with other messages) */}
            {isSettingDestination && (
              <div className="absolute top-3 left-3 right-3 md:left-1/2 md:-translate-x-1/2 md:w-auto md:max-w-md z-[480] flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-purple-600/95 backdrop-blur-md text-white font-bold text-xs shadow-2xl border-2 border-white animate-in slide-in-from-top-3 duration-200">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Crosshair className="w-4 h-4 animate-spin text-purple-200 shrink-0" />
                  <div className="min-w-0">
                    <span className="truncate block font-black text-xs">Toca el mapa para fijar tu destino</span>
                    <span className="text-[10px] text-purple-200 font-normal">Radio de búsqueda: ±{formatDistance(settings.searchRadiusMeters)}</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsSettingDestination(false)}
                  className="px-2.5 py-1 rounded-xl bg-purple-800 hover:bg-purple-900 text-white font-bold text-xs shrink-0 shadow active:scale-95 transition-all"
                >
                  Cancelar
                </button>
              </div>
            )}

            {/* Floating Destination & Match Hub Card (Lower 50% on mobile leaving top 50% for map, sidebar on desktop) */}
            {destinationPoint && !isSettingDestination && !isMatchCardClosed && (
              <div
                className={`absolute bottom-0 left-0 right-0 z-[410] w-full transition-all duration-300 md:top-16 md:bottom-auto md:left-4 md:right-auto md:w-96 md:max-w-sm flex flex-col ${
                  isMatchCardCollapsed
                    ? 'h-14'
                    : 'h-[50vh] max-h-[50vh] md:h-auto md:max-h-[85vh]'
                }`}
              >
                <div className="p-3 rounded-t-3xl md:rounded-2xl bg-slate-900/95 backdrop-blur-xl border-t border-x md:border border-purple-500/50 shadow-2xl space-y-2 flex flex-col h-full overflow-hidden">
                  {/* Mobile visual drag pill & collapse toggle */}
                  <button
                    onClick={() => setIsMatchCardCollapsed(!isMatchCardCollapsed)}
                    className="w-full flex flex-col items-center py-0.5 -mt-1 md:hidden group"
                    title={
                      isMatchCardCollapsed
                        ? 'Expandir panel de Matches (50% pantalla)'
                        : 'Minimizar panel para ver el mapa completo'
                    }
                  >
                    <div className="w-12 h-1 rounded-full bg-slate-600 group-hover:bg-purple-400 transition-colors" />
                    <span className="text-[9px] text-slate-400 mt-0.5">
                      {isMatchCardCollapsed
                        ? '▲ Desplegar Matches (50% pantalla)'
                        : '▼ Minimizar para ver mapa completo'}
                    </span>
                  </button>

                  {/* Top row: Title, favorite toggle, minimize, change, and close buttons */}
                  <div className="flex items-center justify-between gap-1.5 shrink-0">
                    <div className="flex items-center gap-1.5 text-xs font-black text-purple-300 min-w-0">
                      <Target className="w-4 h-4 text-purple-400 shrink-0" />
                      <span className="truncate">{destinationPoint.name || 'Origen ⇄ Destino'}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30 shrink-0">
                        ±{formatDistance(settings.searchRadiusMeters)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Save to favorites quick button */}
                      <button
                        onClick={() => {
                          if (isDestinationInFavorites) {
                            const match = favoriteDestinations.find(
                              (f) =>
                                destinationPoint &&
                                Math.hypot(f.lat - destinationPoint.lat, f.lng - destinationPoint.lng) < 0.0004
                            );
                            if (match) handleRemoveDestinationFavorite(match.id);
                          } else if (destinationPoint) {
                            const newFav: DestinationFavorite = {
                              id: `fav-${Date.now()}`,
                              name: destinationPoint.name || 'Destino favorito',
                              category: 'favorite',
                              lat: destinationPoint.lat,
                              lng: destinationPoint.lng,
                              icon: '⭐',
                              createdAt: Date.now(),
                            };
                            handleAddDestinationFavorite(newFav);
                          }
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all border flex items-center gap-1 ${
                          isDestinationInFavorites
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                        }`}
                        title={
                          isDestinationInFavorites
                            ? 'En tus favoritos (clic para quitar)'
                            : 'Guardar en destinos favoritos'
                        }
                      >
                        <Star
                          className={`w-3 h-3 ${
                            isDestinationInFavorites
                              ? 'fill-amber-300 text-amber-300'
                              : 'text-slate-400'
                          }`}
                        />
                        <span className="hidden sm:inline">{isDestinationInFavorites ? 'Favorito' : '+ Fav'}</span>
                      </button>

                      {/* Minimize toggle button */}
                      <button
                        onClick={() => setIsMatchCardCollapsed(!isMatchCardCollapsed)}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-purple-300 text-[10px] font-bold transition-all border border-slate-700"
                        title={isMatchCardCollapsed ? 'Restaurar panel a 50%' : 'Minimizar ventana'}
                      >
                        {isMatchCardCollapsed ? '▲' : '–'}
                      </button>

                      <button
                        onClick={() => setIsDestinationMenuOpen(true)}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-purple-300 text-[10px] font-bold transition-all border border-slate-700"
                        title="Cambiar destino o elegir favorito"
                      >
                        Cambiar
                      </button>

                      {/* Close Window button */}
                      <button
                        id="btn-close-match-card"
                        onClick={() => setIsMatchCardClosed(true)}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-rose-950/70 text-slate-300 hover:text-rose-200 text-[10px] font-bold transition-all border border-slate-700 flex items-center gap-0.5"
                        title="Cerrar ventana (el destino sigue activo)"
                      >
                        <X className="w-3 h-3" />
                        <span className="hidden sm:inline">Cerrar</span>
                      </button>

                      {/* Clear Destination button */}
                      <button
                        id="btn-clear-destination"
                        onClick={handleClearDestinationPoint}
                        className="w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 text-xs transition-all"
                        title="Quitar punto de destino completamente"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Restorable tap bar when minimized */}
                  {isMatchCardCollapsed && (
                    <button
                      onClick={() => setIsMatchCardCollapsed(false)}
                      className="w-full flex items-center justify-between px-2.5 py-1 rounded-xl bg-purple-950/70 hover:bg-purple-900/80 border border-purple-500/40 text-purple-200 text-xs font-bold transition-all"
                      title="Restaurar ventana a mitad inferior (50% pantalla)"
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <Target className="w-3.5 h-3.5 text-purple-400 animate-pulse shrink-0" />
                        <span className="truncate">{destinationPoint.name || 'Destino fijado'}</span>
                      </span>
                      <span className="text-[10px] text-amber-300 font-bold shrink-0 flex items-center gap-1">
                        ▲ Restaurar (50%)
                      </span>
                    </button>
                  )}

                  {/* Distance summary */}
                  <div className="flex items-baseline justify-between text-[11px] text-slate-300">
                    <span className="text-slate-400">Distancia entre zonas:</span>
                    <span className="font-bold text-white text-xs">{formatDistance(distanceOriginToDest || 0)}</span>
                  </div>

                  {/* If Direct Match lines exist */}
                  {matchedLines.length > 0 ? (
                    <div className="space-y-2 pt-1 border-t border-slate-800">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-amber-400 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{matchedLines.length} {matchedLines.length === 1 ? 'Línea con Match directo' : 'Líneas con Match directo'}:</span>
                        </span>
                      </div>

                      {/* Direction Color Legend */}
                      <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-slate-950/70 border border-slate-800 text-[10px] font-bold">
                        <div className="flex items-center gap-1 text-emerald-400">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-emerald-300"></span>
                          <span>Ida (hacia destino) ➔</span>
                        </div>
                        <div className="flex items-center gap-1 text-rose-400">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-rose-300"></span>
                          <span>Vuelta (a origen) ↩</span>
                        </div>
                      </div>

                      {/* Estimated Arrival Times (ETAs) at matched stops ordered by total door-to-door arrival time (Requirement 4) */}
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {matchedLineETAs.map((eta, idx) => {
                          const isSelected = selectedLine?.code === eta.lineCode;
                          return (
                            <div
                              key={eta.lineCode}
                              onClick={() => {
                                const line = network.lines.find((l) => l.code === eta.lineCode);
                                if (line) {
                                  if (selectedLine?.code === line.code) {
                                    setSelectedLine(null);
                                  } else {
                                    handleSelectLine(line);
                                  }
                                }
                              }}
                              className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-amber-950/90 border-amber-400 ring-2 ring-amber-400/60 shadow-lg'
                                  : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700/60'
                              }`}
                              title={`Línea ${eta.lineCode} - Pulsa para ver trayecto D3 y resaltar paradas`}
                            >
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className="px-2 py-0.5 rounded-md font-black text-[11px] text-white shrink-0 shadow-sm"
                                    style={{ backgroundColor: eta.color }}
                                  >
                                    {eta.transportType === 'metro'
                                      ? '🚇 '
                                      : eta.transportType === 'nitbus'
                                      ? '🌙 '
                                      : eta.transportType === 'rodalies'
                                      ? '🚆 '
                                      : eta.transportType === 'fgc'
                                      ? '🚉 '
                                      : ''}
                                    {eta.lineCode}
                                  </span>
                                  <div className="truncate">
                                    <div className="font-bold text-white truncate text-xs flex items-center gap-1.5 flex-wrap">
                                      <span>{eta.lineName}</span>
                                      {idx === 0 && (
                                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-black border border-amber-500/40 shrink-0">
                                          ⚡ Más rápida
                                        </span>
                                      )}
                                      {/* Icono de Estado / Fiabilidad del dato (Requirement: iBus real vs estimación de frecuencia) */}
                                      {eta.isRealTime || eta.sourceType === 'ibus_real' ? (
                                        <span
                                          className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shadow-sm shrink-0"
                                          title="Tiempo real vía telemetría GPS iBus TMB oficial (Alta fiabilidad)"
                                        >
                                          <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                                          <span>iBus Real</span>
                                        </span>
                                      ) : (
                                        <span
                                          className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0"
                                          title="Tiempo estimado basado en la frecuencia teórica de paso (Orientativo)"
                                        >
                                          <Clock className="w-2.5 h-2.5 text-amber-400" />
                                          <span>Estimado</span>
                                        </span>
                                      )}
                                      {eta.inService === false && (
                                        <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[9px] font-bold border border-rose-500/40 shrink-0">
                                          🌙 Fuera de horario
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                      Sube: <strong className="text-slate-200">{eta.originStopName}</strong> ➔ Baja: <strong className="text-slate-200">{eta.destStopName}</strong>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right shrink-0 flex flex-col items-end">
                                  <div className="font-black text-amber-300 text-xs flex items-center justify-end gap-1">
                                    <Clock className="w-3 h-3 text-amber-400" />
                                    <span>~{eta.totalTravelMinutes} min a destino</span>
                                  </div>
                                  <div className="text-[9px] text-emerald-400 font-bold mt-0.5 flex items-center gap-1">
                                    <span>Llega en {eta.nextArrivalMinutes} min</span>
                                    <span className="text-slate-500">·</span>
                                    <span className="text-slate-400 font-normal">Sig: {eta.subsequentArrivalMinutes}m</span>
                                  </div>
                                  {/* Reliability status indicator pill on the arrival column */}
                                  <div className="mt-0.5">
                                    {eta.isRealTime || eta.sourceType === 'ibus_real' ? (
                                      <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-0.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                                        <span>GPS en vivo</span>
                                      </span>
                                    ) : (
                                      <span className="text-[9px] text-amber-400/90 font-medium">
                                        Frecuencia teórica
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Door-to-Door Journey Breakdown (Requirement 4: andar + espera + trayecto + andar) */}
                              <div className="mt-1.5 grid grid-cols-4 gap-1 text-[9px] text-slate-300 bg-slate-900/70 p-1.5 rounded-lg border border-slate-700/50 text-center">
                                <div className="truncate" title={`Caminando a la parada origen (${eta.originStopName})`}>
                                  <span className="text-slate-400">Andar</span>
                                  <div className="font-bold text-white">🚶 {eta.walkToOriginMinutes}m</div>
                                </div>
                                <div className="truncate" title={`Tiempo de espera hasta el autobús/metro línea ${eta.lineCode}`}>
                                  <span className="text-slate-400">Espera</span>
                                  <div className="font-bold text-amber-300">⏳ {eta.waitTimeMinutes}m</div>
                                </div>
                                <div className="truncate" title={`Tiempo en tránsito hasta ${eta.destStopName}`}>
                                  <span className="text-slate-400">Viaje</span>
                                  <div className="font-bold text-blue-300">🚌 {eta.transitTimeMinutes}m</div>
                                </div>
                                <div className="truncate" title="Caminando desde la parada de bajada al destino final">
                                  <span className="text-slate-400">Llegada</span>
                                  <div className="font-bold text-white">🚶 {eta.walkFromDestMinutes}m</div>
                                </div>
                              </div>

                              <div className="mt-1.5 flex items-center justify-between text-[9px] text-slate-400 pt-1 border-t border-slate-700/50">
                                <span className="text-slate-400">
                                  {isSelected ? 'Paradas resaltadas y trayecto D3 visible' : 'Pulsa para resaltar paradas y ver trayecto D3'}
                                </span>
                                <span className="text-amber-400 font-bold">
                                  {isSelected ? 'Ocultar' : 'Ver en mapa ➔'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Quick match filter switch */}
                      <button
                        id="btn-match-filter-quick"
                        onClick={() => {
                          const next = settings.busFilterMode === 'matches_only' ? 'in_radius' : 'matches_only';
                          handleUpdateSettings({ ...settings, busFilterMode: next });
                        }}
                        className={`w-full py-1.5 px-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all border ${
                          settings.busFilterMode === 'matches_only'
                            ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md font-black'
                            : 'bg-slate-800/90 text-amber-300 border-amber-500/30 hover:border-amber-400'
                        }`}
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>
                          {settings.busFilterMode === 'matches_only'
                            ? 'Mostrando solo transporte con Match'
                            : 'Filtrar mapa a solo transporte con Match'}
                        </span>
                      </button>
                    </div>
                  ) : (
                    /* When NO direct match: Propose transit transfers (Transbordos) */
                    <div className="space-y-2 pt-1 border-t border-slate-800">
                      <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                        <div className="flex items-center gap-1">
                          <Shuffle className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Sin conexión directa · Transbordos:</span>
                        </div>
                        <span className="text-[10px] text-slate-400">{transferSuggestions.length} rutas</span>
                      </div>

                      {transferSuggestions.length === 0 ? (
                        <div className="p-2.5 rounded-xl bg-slate-800/70 border border-slate-700/60 text-[11px] text-slate-400 space-y-1">
                          <div className="font-semibold text-slate-300">Sin líneas directas con este radio</div>
                          <div>Prueba a ampliar el radio de búsqueda ({formatDistance(settings.searchRadiusMeters)}) o reubicar el destino.</div>
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {transferSuggestions.map((t) => {
                            const isSelected = selectedTransfer?.id === t.id;
                            return (
                              <div
                                key={t.id}
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedTransfer(null);
                                    setSelectedLine(null);
                                  } else {
                                    setSelectedTransfer(t);
                                    setSelectedLine(t.firstLine);
                                  }
                                }}
                                className={`p-2 rounded-xl border cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-indigo-950/80 border-indigo-400 ring-2 ring-indigo-500/50 shadow-lg'
                                    : 'bg-slate-800/80 border-slate-700/70 hover:border-slate-500'
                                }`}
                              >
                                <div className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-1.5 font-bold">
                                    <span
                                      className="px-1.5 py-0.2 rounded text-[10px] text-white"
                                      style={{ backgroundColor: t.firstLine.color }}
                                    >
                                      {t.firstLine.transportType === 'metro' ? '🚇 ' : ''}{t.firstLine.code}
                                    </span>
                                    <span className="text-slate-400">➔</span>
                                    <span
                                      className="px-1.5 py-0.2 rounded text-[10px] text-white"
                                      style={{ backgroundColor: t.secondLine.color }}
                                    >
                                      {t.secondLine.transportType === 'metro' ? '🚇 ' : ''}{t.secondLine.code}
                                    </span>
                                  </div>
                                  <div className="font-extrabold text-indigo-300 text-xs flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-indigo-400" />
                                    <span>~{t.estimatedMinutes} min</span>
                                  </div>
                                </div>

                                <div className="mt-1 text-[10px] text-slate-300 flex items-center gap-1">
                                  <span className="text-indigo-400 font-bold">Transbordo:</span>
                                  <span className="truncate">{t.transferStationName}</span>
                                </div>

                                <div className="mt-1 flex items-center justify-between text-[9px] text-slate-400 pt-1 border-t border-slate-700/60">
                                  <span className="truncate">Sube en: {t.firstStop.name}</span>
                                  <span className="text-indigo-300 font-bold shrink-0 ml-1">
                                    {isSelected ? 'Ocultar ruta' : 'Ver en mapa ➔'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Floating Restore Pill when Match Hub is closed (Requirement 1: restaurar ventana) */}
            {destinationPoint && !isSettingDestination && isMatchCardClosed && (
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-[420] flex items-center gap-1.5 p-1.5 bg-slate-900/95 border border-purple-500/60 rounded-full shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
                <button
                  onClick={() => {
                    setIsMatchCardClosed(false);
                    setIsMatchCardCollapsed(false);
                  }}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md active:scale-95 transition-all"
                  title="Restaurar ventana de Matches y Destino"
                >
                  <Target className="w-4 h-4 text-purple-200 animate-pulse shrink-0" />
                  <span className="truncate max-w-[150px] sm:max-w-[200px]">
                    Restaurar: {destinationPoint.name || 'Destino'}
                  </span>
                  <span className="px-1.5 py-0.2 rounded-full bg-purple-900 text-[10px] text-purple-200 font-black shrink-0">
                    {matchedLines.length} {matchedLines.length === 1 ? 'Match' : 'Matches'}
                  </span>
                </button>
                <button
                  onClick={handleClearDestinationPoint}
                  className="w-7 h-7 rounded-full bg-slate-800 hover:bg-rose-950/50 hover:text-rose-300 text-slate-400 flex items-center justify-center text-xs transition-colors shrink-0"
                  title="Quitar destino actual del mapa"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Modal de Configuración de Radio (Garantizado 100% dentro de la pantalla siempre) */}
            {showRadiusPopover && (
              <div
                className="fixed inset-0 z-[650] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
                onClick={() => setShowRadiusPopover(false)}
              >
                <div
                  id="radius-modal-dialog"
                  className="w-full max-w-sm max-h-[85vh] overflow-y-auto bg-slate-900 border border-slate-700/80 rounded-3xl p-5 shadow-2xl space-y-4 text-white animate-in zoom-in-95 duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-300">
                        <Compass className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white">Radio de Búsqueda</h3>
                        <p className="text-[10px] text-slate-400">Alcance de paradas y líneas en origen y destino</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowRadiusPopover(false)}
                      className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs transition-colors"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 font-medium">Distancia actual:</span>
                    <span className="font-extrabold text-blue-400 text-sm">
                      ±{formatDistance(settings.searchRadiusMeters)}
                    </span>
                  </div>

                  {/* Presets */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400">Accesos rápidos:</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[300, 500, 800, 1000, 1500, 2500].map((dist) => (
                        <button
                          key={dist}
                          onClick={() => {
                            handleUpdateSettings({ ...settings, searchRadiusMeters: dist });
                          }}
                          className={`py-2 px-1 text-xs font-bold rounded-xl border transition-all active:scale-95 ${
                            settings.searchRadiusMeters === dist
                              ? 'bg-blue-600 text-white border-blue-400 font-black shadow-md shadow-blue-900/30'
                              : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-slate-600'
                          }`}
                        >
                          {formatDistance(dist)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Slider */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-300">
                      <span>Ajuste con deslizador</span>
                      <span className="text-blue-400 font-bold">{settings.searchRadiusMeters} m</span>
                    </div>
                    <input
                      type="range"
                      min="100"
                      max="5000"
                      step="50"
                      value={settings.searchRadiusMeters}
                      onChange={(e) =>
                        handleUpdateSettings({ ...settings, searchRadiusMeters: Number(e.target.value) })
                      }
                      className="w-full h-2.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>100 m</span>
                      <span>1.0 km</span>
                      <span>5.0 km</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800 text-center">
                    <span className="text-emerald-400 font-bold">{stopsWithinRadius.length}</span> de {network.stops.length} paradas en este radio
                  </div>

                  {/* Bus filter mode option */}
                  <div className="pt-2 border-t border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300">Autobuses en el mapa:</span>
                      <span className="text-[11px] font-bold text-amber-400">
                        {displayedBuses.length} visibles
                      </span>
                    </div>
                    <div className={`grid ${destinationPoint ? 'grid-cols-3' : 'grid-cols-2'} gap-1.5`}>
                      <button
                        id="btn-modal-bus-in-radius"
                        onClick={() => handleUpdateSettings({ ...settings, busFilterMode: 'in_radius' })}
                        className={`py-1.5 px-1.5 text-[10px] font-semibold rounded-lg border flex items-center justify-center gap-1 transition-all ${
                          settings.busFilterMode === 'in_radius'
                            ? 'bg-blue-600 text-white border-blue-400 font-bold shadow-sm'
                            : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                      >
                        <Check className={`w-3 h-3 ${settings.busFilterMode === 'in_radius' ? 'opacity-100' : 'opacity-0'}`} />
                        <span>{destinationPoint ? 'En zonas' : 'En radio'}</span>
                      </button>
                      {destinationPoint && (
                        <button
                          id="btn-modal-bus-matches"
                          onClick={() => handleUpdateSettings({ ...settings, busFilterMode: 'matches_only' })}
                          className={`py-1.5 px-1.5 text-[10px] font-semibold rounded-lg border flex items-center justify-center gap-1 transition-all ${
                            settings.busFilterMode === 'matches_only'
                              ? 'bg-amber-500 text-slate-950 border-amber-300 font-bold shadow-sm'
                              : 'bg-slate-800/80 text-amber-300 border-slate-700 hover:text-white'
                          }`}
                        >
                          <Check className={`w-3 h-3 ${settings.busFilterMode === 'matches_only' ? 'opacity-100' : 'opacity-0'}`} />
                          <span>Matches ({matchedLines.length})</span>
                        </button>
                      )}
                      <button
                        id="btn-modal-bus-all"
                        onClick={() => handleUpdateSettings({ ...settings, busFilterMode: 'all' })}
                        className={`py-1.5 px-1.5 text-[10px] font-semibold rounded-lg border flex items-center justify-center gap-1 transition-all ${
                          settings.busFilterMode === 'all'
                            ? 'bg-blue-600 text-white border-blue-400 font-bold shadow-sm'
                            : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                      >
                        <Check className={`w-3 h-3 ${settings.busFilterMode === 'all' ? 'opacity-100' : 'opacity-0'}`} />
                        <span>Todos</span>
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800">
                    <button
                      onClick={() => setShowRadiusPopover(false)}
                      className="w-full py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-900/30 active:scale-95 transition-all"
                    >
                      Aceptar
                    </button>
                  </div>
                </div>
              </div>
            )}

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
            favoriteDestinations={favoriteDestinations}
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
            onSelectDestination={(lat, lng, name) => {
              handleSetDestinationPoint(lat, lng, name);
              setActiveTab('map');
            }}
            onRemoveFavorite={handleRemoveFavorite}
            onAddStopFavorite={handleToggleFavoriteStop}
            onAddDestinationFavorite={handleAddDestinationFavorite}
            onRemoveDestinationFavorite={handleRemoveDestinationFavorite}
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

      {/* Destination Menu Dropdown Modal (Recent 3 destinations, favorites, map picker, address search) */}
      <DestinationMenu
        isOpen={isDestinationMenuOpen}
        onClose={() => setIsDestinationMenuOpen(false)}
        onStartMapSelection={() => {
          setIsSettingDestination(true);
          setIsDestinationMenuOpen(false);
        }}
        onSelectDestination={(lat, lng, name) => {
          handleSetDestinationPoint(lat, lng, name);
          setIsDestinationMenuOpen(false);
        }}
        onClearDestination={handleClearDestinationPoint}
        currentDestination={destinationPoint}
        userLocation={userLocation}
        center={network.center}
        searchRadius={settings.searchRadiusMeters}
        recentDestinations={recentDestinations}
        favoriteDestinations={favoriteDestinations}
        onAddFavorite={handleAddDestinationFavorite}
        onRemoveFavorite={handleRemoveDestinationFavorite}
        onOpenAddressSearch={() => setIsAddressSearchOpen(true)}
      />

      {/* Nearby Favorite Stops Modal (Fullscreen, within 500m of GPS, arrival times on click) */}
      <NearbyFavoriteStopsModal
        isOpen={isNearbyFavoriteStopsOpen}
        onClose={() => setIsNearbyFavoriteStopsOpen(false)}
        userLocation={userLocation}
        stops={network.stops}
        lines={network.lines}
        buses={network.buses}
        favorites={favorites}
        onToggleFavorite={handleToggleFavoriteStop}
        onSelectStopOnMap={(stop) => {
          handleSelectStop(stop);
          setActiveTab('map');
        }}
      />

      {/* Address Search Modal (Search address, with options to set as destination or explore without destination) */}
      <AddressSearchModal
        isOpen={isAddressSearchOpen}
        onClose={() => setIsAddressSearchOpen(false)}
        userLat={userLocation?.lat}
        userLng={userLocation?.lng}
        onSelectAsDestination={(lat, lng, name) => {
          handleSetDestinationPoint(lat, lng, name);
          setIsMatchCardClosed(false);
          setIsMatchCardCollapsed(false);
          setActiveTab('map');
        }}
        onExploreLocation={(lat, lng, name) => {
          setExplorePoint({ lat, lng, name });
          setActiveTab('map');
        }}
      />
    </div>
  );
}
