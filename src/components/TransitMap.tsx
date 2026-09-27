import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { LocateFixed } from 'lucide-react';
import { BusStop, BusLine, LiveBus, UserPosition } from '../types/transit';

interface TransitMapProps {
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

  // Layer groups for clean updates
  const userLayerRef = useRef<L.LayerGroup | null>(null);
  const stopsLayerRef = useRef<L.LayerGroup | null>(null);
  const busesLayerRef = useRef<L.LayerGroup | null>(null);
  const routesLayerRef = useRef<L.LayerGroup | null>(null);
  const radiusLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = userLocation?.lat || 40.4194;
    const initialLng = userLocation?.lng || -3.7038;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
    });

    mapInstanceRef.current = map;

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

  // Handle Tile Layer changes (Dark mode vs Light mode)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const tileUrl = isDarkMode
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    const tileLayer = L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: 'abcd',
    });

    tileLayer.addTo(map);
    tileLayerRef.current = tileLayer;
  }, [isDarkMode]);

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

    // Search Radius visual guide circle
    if (radiusLayerRef.current) {
      radiusLayerRef.current.clearLayers();
      const searchCircle = L.circle([userLocation.lat, userLocation.lng], {
        radius: searchRadius,
        color: '#60a5fa',
        weight: 1.5,
        dashArray: '4, 8',
        fillColor: '#60a5fa',
        fillOpacity: 0.03,
      });
      radiusLayerRef.current.addLayer(searchCircle);
    }
  }, [userLocation, searchRadius]);

  // Update Bus Stops
  useEffect(() => {
    const group = stopsLayerRef.current;
    if (!group) return;

    group.clearLayers();

    stops.forEach((stop) => {
      const isSelected = selectedStop?.id === stop.id;

      // Custom Stop Pin
      const stopIcon = L.divIcon({
        className: 'custom-stop-marker',
        html: `
          <div class="cursor-pointer transition-transform duration-200 hover:scale-110 flex flex-col items-center group">
            <div class="flex items-center justify-center w-7 h-7 rounded-full shadow-md border-2 transition-all ${
              isSelected
                ? 'bg-amber-500 border-white ring-4 ring-amber-500/40 scale-125 z-50'
                : 'bg-slate-800 border-blue-400 text-white hover:border-amber-400'
            }">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 ${isSelected ? 'text-slate-950 font-bold' : 'text-blue-300'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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
                : 'bg-slate-900/90 text-slate-200 border border-slate-700/80'
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
        zIndexOffset: isSelected ? 800 : 200,
      });

      marker.on('click', () => {
        onSelectStop(stop);
      });

      group.addLayer(marker);
    });
  }, [stops, selectedStop, onSelectStop]);

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

  return (
    <div className="relative w-full h-full">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0 outline-none" />

      {/* Floating GPS Recenter FAB */}
      <div className="absolute right-4 bottom-28 md:bottom-24 z-[400] flex flex-col gap-2">
        <button
          id="btn-recenter-gps"
          onClick={onRecenter}
          className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-600/30 active:scale-95 transition-all border border-blue-400/40"
          title="Centrar en mi ubicación GPS"
          aria-label="Centrar en mi ubicación"
        >
          <LocateFixed className="w-6 h-6" />
        </button>
      </div>

      {/* Real-time moving buses legend pill */}
      <div className="absolute top-4 left-4 z-[400] pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-700/70 text-xs text-slate-200 shadow-lg">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
          <span className="font-semibold text-[11px]">
            {buses.length} autobuses en vivo con GPS
          </span>
        </div>
      </div>
    </div>
  );
};
