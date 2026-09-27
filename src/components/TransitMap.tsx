import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { LocateFixed, Layers } from 'lucide-react';
import { BusStop, BusLine, LiveBus, UserPosition } from '../types/transit';
import { getDistanceMeters } from '../utils/geo';

interface TransitMapProps {
  center?: [number, number];
  userLocation: UserPosition | null;
  stops: BusStop[];
  lines: BusLine[];
  buses: LiveBus[];
  selectedStop: BusStop | null;
  selectedLine: BusLine | null;
  onSelectStop: (stop: BusStop) => void;
  onSelectBus?: (bus: LiveBus) => void;
  isDarkMode: boolean;
  searchRadius: number;
  onRecenter: () => void;
  onManualLocationSelect?: (lat: number, lng: number) => void;
}

export const TransitMap: React.FC<TransitMapProps> = ({
  center,
  userLocation,
  stops,
  lines,
  buses,
  selectedStop,
  selectedLine,
  onSelectStop,
  isDarkMode,
  searchRadius,
  onRecenter,
  onManualLocationSelect,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [mapViewBounds, setMapViewBounds] = useState<L.LatLngBounds | null>(null);
  const [mapZoom, setMapZoom] = useState<number>(16);

  // Layer groups for clean updates
  const userLayerRef = useRef<L.LayerGroup | null>(null);
  const stopsLayerRef = useRef<L.LayerGroup | null>(null);
  const busesLayerRef = useRef<L.LayerGroup | null>(null);
  const routesLayerRef = useRef<L.LayerGroup | null>(null);
  const radiusLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map with Barcelona Plaça de Catalunya coordinates
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = userLocation?.lat || center?.[0] || 41.3879;
    const initialLng = userLocation?.lng || center?.[1] || 2.1699;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
    });

    mapInstanceRef.current = map;

    // Track bounds for performant rendering of Barcelona stops
    const handleMove = () => {
      setMapViewBounds(map.getBounds());
      setMapZoom(map.getZoom());
    };
    map.on('moveend', handleMove);
    map.on('zoomend', handleMove);
    map.whenReady(handleMove);

    // Create Layer Groups
    routesLayerRef.current = L.layerGroup().addTo(map);
    radiusLayerRef.current = L.layerGroup().addTo(map);
    stopsLayerRef.current = L.layerGroup().addTo(map);
    busesLayerRef.current = L.layerGroup().addTo(map);
    userLayerRef.current = L.layerGroup().addTo(map);

    // Manual click on map to set location if desired
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (onManualLocationSelect) {
        onManualLocationSelect(e.latlng.lat, e.latlng.lng);
      }
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Center change listener (e.g. user selects a Barcelona hub)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !center) return;
    map.flyTo(center, Math.max(15, map.getZoom() || 16), {
      animate: true,
      duration: 0.8,
    });
  }, [center?.[0], center?.[1]]);

  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets');

  // Handle Tile Layer changes (Dark mode vs Light mode & Street vs Satellite)
  // Uses open tiles (OpenStreetMap & Esri) which do not require any API keys.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    let tileOptions: L.TileLayerOptions = {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
      attribution: '&copy; OpenStreetMap contributors',
      className: isDarkMode ? 'leaflet-tile-dark' : 'leaflet-tile-light',
    };

    if (mapStyle === 'satellite') {
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      tileOptions = {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri',
        className: 'leaflet-tile-light',
      };
    }

    const tileLayer = L.tileLayer(tileUrl, tileOptions);
    tileLayer.addTo(map);
    tileLayerRef.current = tileLayer;
  }, [isDarkMode, mapStyle]);

  // Update User Location & Accuracy Circle
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = userLayerRef.current;
    if (!map || !group || !userLocation) return;

    group.clearLayers();

    // User Location Pulsing Dot Icon
    const userIcon = L.divIcon({
      className: 'custom-user-marker',
      html: `
        <div class="relative flex items-center justify-center w-8 h-8">
          <span class="absolute w-8 h-8 rounded-full bg-blue-500/30 animate-ping"></span>
          <span class="absolute w-6 h-6 rounded-full bg-blue-500/40"></span>
          <span class="relative w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-md shadow-blue-500/50"></span>
          ${
            userLocation.heading !== null
              ? `<div class="absolute -top-3 text-blue-500 text-xs transform -translate-y-1" style="transform: rotate(${userLocation.heading}deg)">▲</div>`
              : ''
          }
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const marker = L.marker([userLocation.lat, userLocation.lng], {
      icon: userIcon,
      zIndexOffset: 1000,
    });
    marker.bindPopup(`
      <div class="text-xs font-sans text-slate-800">
        <strong class="text-blue-600">Tu Ubicación GPS</strong><br/>
        Precisión: ±${Math.round(userLocation.accuracy)} m<br/>
        ${userLocation.isSimulated ? '<span class="text-amber-600 font-medium">Ubicación asistida/demo</span>' : 'Señal GPS activa'}
      </div>
    `);

    group.addLayer(marker);

    // Accuracy Circle
    const accuracyRadius = Math.max(15, Math.min(80, userLocation.accuracy));
    const accuracyCircle = L.circle([userLocation.lat, userLocation.lng], {
      radius: accuracyRadius,
      color: '#3b82f6',
      weight: 1,
      fillColor: '#3b82f6',
      fillOpacity: 0.12,
    });
    group.addLayer(accuracyCircle);

    // Search Radius visual guide circle around user location or current map center
    if (radiusLayerRef.current) {
      radiusLayerRef.current.clearLayers();
      const circleLat = userLocation?.lat ?? center?.[0] ?? 41.3879;
      const circleLng = userLocation?.lng ?? center?.[1] ?? 2.1699;

      const searchCircle = L.circle([circleLat, circleLng], {
        radius: searchRadius,
        color: '#3b82f6',
        weight: 1.5,
        dashArray: '5, 8',
        fillColor: '#3b82f6',
        fillOpacity: 0.04,
      });

      const radiusLabel = searchRadius >= 1000 ? `${(searchRadius / 1000).toFixed(1)} km` : `${searchRadius} m`;
      searchCircle.bindTooltip(`Radio de búsqueda: ${radiusLabel}`, {
        permanent: false,
        direction: 'top',
        className: 'leaflet-radius-tooltip',
      });

      radiusLayerRef.current.addLayer(searchCircle);
    }
  }, [userLocation, center, searchRadius]);

  // Update Bus Stops
  useEffect(() => {
    const group = stopsLayerRef.current;
    if (!group) return;

    group.clearLayers();

    const originLat = userLocation?.lat ?? center?.[0];
    const originLng = userLocation?.lng ?? center?.[1];

    const selectedLineStopIds = new Set(selectedLine ? selectedLine.stops : []);
    const paddedBounds = mapViewBounds ? mapViewBounds.pad(0.2) : null;

    // Filter stops to render smoothly
    const stopsToRender: { stop: BusStop; isWithinRadius: boolean; isSelected: boolean }[] = [];

    for (const stop of stops) {
      const isSelected = selectedStop?.id === stop.id;
      const isOnSelectedLine = selectedLineStopIds.has(stop.id);

      let isWithinRadius = false;
      if (originLat !== undefined && originLng !== undefined) {
        const distMeters = getDistanceMeters(originLat, originLng, stop.lat, stop.lng);
        isWithinRadius = distMeters <= searchRadius;
      }

      // Always include selected stop, stops on selected line, or within user search radius
      if (isSelected || isOnSelectedLine || isWithinRadius) {
        stopsToRender.push({ stop, isWithinRadius, isSelected });
        continue;
      }

      // Include viewport stops if zoomed in (up to 350)
      if (paddedBounds && paddedBounds.contains([stop.lat, stop.lng])) {
        if (mapZoom >= 14 && stopsToRender.length < 350) {
          stopsToRender.push({ stop, isWithinRadius: false, isSelected: false });
        } else if (mapZoom < 14 && stopsToRender.length < 60) {
          stopsToRender.push({ stop, isWithinRadius: false, isSelected: false });
        }
      }
    }

    stopsToRender.forEach(({ stop, isWithinRadius, isSelected }) => {
      // Custom Stop Pin
      const stopIcon = L.divIcon({
        className: 'custom-stop-marker',
        html: `
          <div class="cursor-pointer transition-transform duration-200 hover:scale-110 flex flex-col items-center group ${
            isWithinRadius ? 'opacity-100' : 'opacity-40 hover:opacity-90'
          }">
            <div class="flex items-center justify-center w-7 h-7 rounded-full shadow-md border-2 transition-all ${
              isSelected
                ? 'bg-amber-500 border-white ring-4 ring-amber-500/40 scale-125 z-50'
                : isWithinRadius
                ? 'bg-slate-800 border-blue-400 text-white hover:border-amber-400 ring-2 ring-blue-500/20'
                : 'bg-slate-900 border-slate-600 text-slate-400 hover:border-blue-400'
            }">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 ${isSelected ? 'text-slate-950 font-bold' : isWithinRadius ? 'text-blue-300' : 'text-slate-400'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 6v6"></path>
                <path d="M15 6v6"></path>
                <path d="M2 12h19.6"></path>
                <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"></path>
                <circle cx="7" cy="18" r="2"></circle>
                <circle cx="15" cy="18" r="2"></circle>
              </svg>
            </div>
            <div class="mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tight shadow-sm whitespace-nowrap ${
              isSelected
                ? 'bg-amber-500 text-slate-950'
                : isWithinRadius
                ? 'bg-slate-900/90 text-slate-200 border border-slate-700/80'
                : 'bg-slate-950/80 text-slate-400 border border-slate-800'
            }">
              ${stop.code}
            </div>
          </div>
        `,
        iconSize: [32, 48],
        iconAnchor: [16, 24],
      });

      const marker = L.marker([stop.lat, stop.lng], {
        icon: stopIcon,
        zIndexOffset: isSelected ? 800 : isWithinRadius ? 300 : 100,
      });

      marker.on('click', () => {
        onSelectStop(stop);
      });

      group.addLayer(marker);
    });
  }, [stops, selectedStop, selectedLine, onSelectStop, userLocation, center, searchRadius, mapViewBounds, mapZoom]);

  // Update Route Polylines
  useEffect(() => {
    const group = routesLayerRef.current;
    if (!group) return;

    group.clearLayers();

    // If a line is explicitly selected, or if a stop is selected, draw relevant line paths
    const linesToDraw = selectedLine
      ? [selectedLine]
      : selectedStop
      ? lines.filter((l) => selectedStop.lines.includes(l.code))
      : [];

    linesToDraw.forEach((line) => {
      const polyline = L.polyline(line.path, {
        color: line.color,
        weight: selectedLine?.code === line.code ? 5 : 3.5,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: selectedLine?.code === line.code ? undefined : '6, 6',
      });

      polyline.bindTooltip(
        `<div class="font-bold text-xs" style="color: ${line.color}">${line.code} - ${line.name}</div>`,
        { sticky: true }
      );

      group.addLayer(polyline);
    });
  }, [lines, selectedLine, selectedStop]);

  // Update Moving Live Buses
  useEffect(() => {
    const group = busesLayerRef.current;
    if (!group) return;

    group.clearLayers();

    buses.forEach((bus) => {
      const line = lines.find((l) => l.code === bus.lineCode);
      const color = line?.color || '#2563eb';

      // Live bus icon with line badge and directional rotation
      const busIcon = L.divIcon({
        className: 'custom-live-bus-marker',
        html: `
          <div class="relative flex items-center justify-center transition-all duration-700 ease-linear">
            <!-- Pulsing outer ring -->
            <div class="absolute w-8 h-8 rounded-full opacity-30 animate-ping" style="background-color: ${color}"></div>
            <!-- Main Bus Pill -->
            <div class="flex items-center gap-1 px-1.5 py-0.5 rounded-full shadow-lg border-2 border-white text-white font-extrabold text-[11px] leading-tight" style="background-color: ${color}">
              <span class="text-[10px]">🚌</span>
              <span>${bus.lineCode}</span>
            </div>
            <!-- Directional compass arrowhead -->
            <div class="absolute -bottom-2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-white" style="transform: rotate(${bus.heading}deg) translateY(12px);"></div>
          </div>
        `,
        iconSize: [44, 28],
        iconAnchor: [22, 14],
      });

      const marker = L.marker([bus.lat, bus.lng], {
        icon: busIcon,
        zIndexOffset: 600,
      });

      marker.bindPopup(`
        <div class="p-1 font-sans text-xs text-slate-800">
          <div class="flex items-center gap-1.5 font-bold" style="color: ${color}">
            <span class="px-1.5 py-0.5 rounded text-white text-[10px]" style="background-color: ${color}">${bus.lineCode}</span>
            <span>${line?.name || 'Línea de Autobús'}</span>
          </div>
          <div class="mt-1 text-[11px] text-slate-600">
            <div>Matrícula: <strong>${bus.plate}</strong></div>
            <div>Velocidad: <strong>${Math.round(bus.speedKmh)} km/h</strong></div>
            <div>Ocupación: <span class="capitalize font-semibold">${bus.occupancy === 'low' ? '🟢 Baja' : bus.occupancy === 'medium' ? '🟡 Media' : '🔴 Alta'}</span></div>
            <div>Accesibilidad: ${bus.isAccessible ? '♿ Sí (PMR)' : 'Estándar'}</div>
          </div>
        </div>
      `);

      group.addLayer(marker);
    });
  }, [buses, lines]);

  // Center on selected stop when changed
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedStop) return;

    map.panTo([selectedStop.lat, selectedStop.lng], {
      animate: true,
      duration: 0.8,
    });
  }, [selectedStop]);

  // Direct, robust GPS recentering with instant smooth flyTo animation
  const handleRecenterClick = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    setIsLocating(true);

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setIsLocating(false);
          const { latitude, longitude } = pos.coords;
          map.flyTo([latitude, longitude], 16, {
            animate: true,
            duration: 1.0,
          });
          onRecenter();
        },
        (err) => {
          console.warn('GPS location query failed:', err.message);
          setIsLocating(false);
          if (userLocation) {
            map.flyTo([userLocation.lat, userLocation.lng], 16, {
              animate: true,
              duration: 0.8,
            });
          } else if (center) {
            map.flyTo(center, 16, {
              animate: true,
              duration: 0.8,
            });
          } else {
            map.flyTo([41.3879, 2.1699], 16, {
              animate: true,
              duration: 0.8,
            });
          }
          onRecenter();
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 2000 }
      );
    } else if (userLocation) {
      setIsLocating(false);
      map.flyTo([userLocation.lat, userLocation.lng], 16, {
        animate: true,
        duration: 0.8,
      });
      onRecenter();
    } else {
      setIsLocating(false);
      map.flyTo([41.3879, 2.1699], 16, {
        animate: true,
        duration: 0.8,
      });
      onRecenter();
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0 outline-none" />

      {/* Floating Action Buttons */}
      <div className="absolute right-4 bottom-28 md:bottom-24 z-[400] flex flex-col gap-2.5">
        {/* Toggle Map Style (Street / Satellite) */}
        <button
          id="btn-toggle-map-style"
          onClick={() => setMapStyle((prev) => (prev === 'streets' ? 'satellite' : 'streets'))}
          className="flex items-center justify-center w-11 h-11 rounded-full bg-slate-800/90 hover:bg-slate-700 text-slate-200 shadow-xl shadow-black/40 active:scale-95 transition-all border border-slate-600/80 backdrop-blur-md"
          title={mapStyle === 'streets' ? 'Cambiar a vista satélite' : 'Cambiar a mapa callejero'}
          aria-label="Cambiar estilo de mapa"
        >
          <Layers className="w-5 h-5 text-slate-200" />
        </button>

        {/* Floating GPS Recenter FAB */}
        <button
          id="btn-recenter-gps"
          onClick={handleRecenterClick}
          disabled={isLocating}
          className={`flex items-center justify-center w-12 h-12 rounded-full text-white shadow-xl shadow-blue-600/30 active:scale-95 transition-all border border-blue-400/40 ${
            isLocating ? 'bg-blue-700 ring-4 ring-blue-500/40' : 'bg-blue-600 hover:bg-blue-500'
          }`}
          title="Centrar en mi ubicación GPS"
          aria-label="Centrar en mi ubicación"
        >
          <LocateFixed className={`w-6 h-6 ${isLocating ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Network status pill */}
      <div className="absolute top-4 left-4 z-[400] pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-700/70 text-xs text-slate-200 shadow-lg">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-semibold text-[11px]">
            Red TMB Barcelona Oficial
          </span>
        </div>
      </div>
    </div>
  );
};
