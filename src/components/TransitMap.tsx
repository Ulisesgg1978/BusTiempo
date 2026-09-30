import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import * as d3 from 'd3';
import { LocateFixed, Layers, Crosshair } from 'lucide-react';
import {
  BusStop,
  BusLine,
  LiveBus,
  UserPosition,
  TargetPoint,
  MatchStopRole,
  TransitTransferSuggestion,
  MatchedLineETA,
} from '../types/transit';
import { getDistanceMeters, formatDistance } from '../utils/geo';

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
  // Destination Target Point & Match
  destinationPoint?: TargetPoint | null;
  onSetDestinationPoint?: (lat: number, lng: number) => void;
  onClearDestinationPoint?: () => void;
  isSettingDestination?: boolean;
  matchedLineCodes?: Set<string>;
  stopMatchRoles?: Map<string, MatchStopRole>;
  highlightedTransferStopIds?: Set<string>;
  selectedTransfer?: TransitTransferSuggestion | null;
  allowedMatchStopIds?: Set<string>;
  matchedLineETAs?: MatchedLineETA[];
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
  destinationPoint,
  onSetDestinationPoint,
  isSettingDestination = false,
  matchedLineCodes,
  stopMatchRoles,
  highlightedTransferStopIds,
  selectedTransfer,
  allowedMatchStopIds,
  matchedLineETAs,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [mapViewBounds, setMapViewBounds] = useState<L.LatLngBounds | null>(null);
  const [mapZoom, setMapZoom] = useState<number>(16);

  // Keep references to latest callbacks for leaflet map click events
  const clickHandlerRef = useRef({
    isSettingDestination,
    onSetDestinationPoint,
    onManualLocationSelect,
  });
  useEffect(() => {
    clickHandlerRef.current = {
      isSettingDestination,
      onSetDestinationPoint,
      onManualLocationSelect,
    };
  }, [isSettingDestination, onSetDestinationPoint, onManualLocationSelect]);

  // Layer groups for clean updates
  const userLayerRef = useRef<L.LayerGroup | null>(null);
  const stopsLayerRef = useRef<L.LayerGroup | null>(null);
  const busesLayerRef = useRef<L.LayerGroup | null>(null);
  const routesLayerRef = useRef<L.LayerGroup | null>(null);
  const radiusLayerRef = useRef<L.LayerGroup | null>(null);
  const destinationLayerRef = useRef<L.LayerGroup | null>(null);
  const d3SvgRef = useRef<SVGSVGElement | null>(null);
  const d3ContainerRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);

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
    destinationLayerRef.current = L.layerGroup().addTo(map);
    stopsLayerRef.current = L.layerGroup().addTo(map);
    busesLayerRef.current = L.layerGroup().addTo(map);
    userLayerRef.current = L.layerGroup().addTo(map);

    // Initialize D3 Overlay Layer attached to Leaflet's overlayPane
    const overlayPane = map.getPanes().overlayPane;
    const d3Svg = d3
      .select(overlayPane)
      .append('svg')
      .attr('class', 'd3-transit-overlay')
      .style('position', 'absolute')
      .style('top', '0')
      .style('left', '0')
      .style('width', '100%')
      .style('height', '100%')
      .style('pointer-events', 'none')
      .style('overflow', 'visible')
      .style('z-index', '450');

    d3SvgRef.current = d3Svg.node();

    // D3 Defs: SVG Glow filters & Markers
    const defs = d3Svg.append('defs');
    const glowFilter = defs
      .append('filter')
      .attr('id', 'd3-transit-glow')
      .attr('x', '-40%')
      .attr('y', '-40%')
      .attr('width', '180%')
      .attr('height', '180%');
    glowFilter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'coloredBlur');
    const feMerge = glowFilter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Arrow markers
    defs
      .append('marker')
      .attr('id', 'd3-arrow-emerald')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', '6')
      .attr('refY', '5')
      .attr('markerWidth', '6')
      .attr('markerHeight', '6')
      .attr('orient', 'auto-start-reverse')
      .append('path')
      .attr('d', 'M 0 1.5 L 8 5 L 0 8.5 z')
      .attr('fill', '#10b981');

    defs
      .append('marker')
      .attr('id', 'd3-arrow-indigo')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', '6')
      .attr('refY', '5')
      .attr('markerWidth', '6')
      .attr('markerHeight', '6')
      .attr('orient', 'auto-start-reverse')
      .append('path')
      .attr('d', 'M 0 1.5 L 8 5 L 0 8.5 z')
      .attr('fill', '#6366f1');

    const container = d3Svg.append('g').attr('class', 'leaflet-zoom-hide d3-transit-group');
    d3ContainerRef.current = container;

    // Click on map to set destination or manual location
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { isSettingDestination: isSetting, onSetDestinationPoint: onSetDest, onManualLocationSelect: onManual } =
        clickHandlerRef.current;

      if (isSetting && onSetDest) {
        onSetDest(e.latlng.lat, e.latlng.lng);
      } else if (onManual) {
        onManual(e.latlng.lat, e.latlng.lng);
      }
    });

    return () => {
      d3Svg.remove();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Center change listener
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !center) return;
    map.flyTo(center, Math.max(15, map.getZoom() || 16), {
      animate: true,
      duration: 0.8,
    });
  }, [center?.[0], center?.[1]]);

  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets');

  // Handle Tile Layer changes
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

  // Update User Location & Accuracy Circle & Origin Radius
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

    const formattedTime = new Date(userLocation.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    marker.bindPopup(`
      <div class="p-1 font-sans text-xs text-slate-800">
        <div class="font-bold flex items-center gap-1.5 text-blue-600">
          <span class="text-sm">📍</span>
          <span>${userLocation.isSimulated ? 'Ubicación seleccionada' : 'Tu posición GPS en directo'}</span>
        </div>
        <div class="mt-1 text-[11px] text-slate-600">
          <div>Precisión: <strong>${Math.round(userLocation.accuracy)} m</strong></div>
          <div>Actualizado: <strong>${formattedTime}</strong></div>
          ${userLocation.speed !== null ? `<div>Velocidad: <strong>${Math.round(userLocation.speed * 3.6)} km/h</strong></div>` : ''}
        </div>
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
      searchCircle.bindTooltip(`Radio de origen: ${radiusLabel}`, {
        permanent: false,
        direction: 'top',
        className: 'leaflet-radius-tooltip',
      });

      radiusLayerRef.current.addLayer(searchCircle);
    }
  }, [userLocation, center, searchRadius]);

  // Update Destination Point & Destination Radius (Same radius as user action radius!)
  useEffect(() => {
    const group = destinationLayerRef.current;
    if (!group) return;

    group.clearLayers();

    if (!destinationPoint) return;

    const radiusLabel = searchRadius >= 1000 ? `${(searchRadius / 1000).toFixed(1)} km` : `${searchRadius} m`;

    // 1. Destination Radius Circle with matching radius
    const destCircle = L.circle([destinationPoint.lat, destinationPoint.lng], {
      radius: searchRadius,
      color: '#a855f7', // Purple-500
      weight: 2,
      dashArray: '6, 8',
      fillColor: '#a855f7',
      fillOpacity: 0.07,
    });

    destCircle.bindTooltip(`Zona Destino (${radiusLabel})`, {
      permanent: false,
      direction: 'top',
      className: 'leaflet-radius-tooltip',
    });

    group.addLayer(destCircle);

    // 2. Destination Pin (Draggable Target Pin)
    const destIcon = L.divIcon({
      className: 'custom-destination-marker',
      html: `
        <div class="cursor-pointer transition-transform duration-200 hover:scale-110 flex flex-col items-center group">
          <div class="relative flex items-center justify-center w-9 h-9 rounded-full shadow-2xl border-2 border-white bg-gradient-to-tr from-purple-700 to-fuchsia-500 ring-4 ring-purple-500/40 text-white font-black text-sm">
            <span>🎯</span>
          </div>
          <div class="mt-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-950/95 text-purple-300 border border-purple-500/60 shadow-md whitespace-nowrap">
            ${destinationPoint.name || 'Punto Destino'}
          </div>
        </div>
      `,
      iconSize: [36, 52],
      iconAnchor: [18, 26],
    });

    const destMarker = L.marker([destinationPoint.lat, destinationPoint.lng], {
      icon: destIcon,
      draggable: true,
      zIndexOffset: 950,
    });

    destMarker.on('dragend', () => {
      const pos = destMarker.getLatLng();
      if (onSetDestinationPoint) {
        onSetDestinationPoint(pos.lat, pos.lng);
      }
    });

    destMarker.bindPopup(`
      <div class="p-1 font-sans text-xs text-slate-800">
        <div class="flex items-center gap-1.5 font-bold text-purple-700">
          <span class="text-sm">🎯</span>
          <span>${destinationPoint.name || 'Punto de Destino'}</span>
        </div>
        <p class="mt-1 text-[11px] text-slate-600">
          Radio de acción: <strong>${radiusLabel}</strong> (idéntico a tu origen).
        </p>
        <div class="mt-1.5 text-[10px] text-slate-500">
          Arrastra este marcador para reubicar tu destino en Barcelona.
        </div>
      </div>
    `);

    group.addLayer(destMarker);
  }, [destinationPoint, searchRadius, onSetDestinationPoint]);

  // Update Bus Stops with Origin, Destination and Match visual tags
  useEffect(() => {
    const group = stopsLayerRef.current;
    if (!group) return;

    group.clearLayers();

    const originLat = userLocation?.lat ?? center?.[0];
    const originLng = userLocation?.lng ?? center?.[1];

    const selectedLineStopIds = new Set(selectedLine ? selectedLine.stops : []);
    const paddedBounds = mapViewBounds ? mapViewBounds.pad(0.2) : null;

    // Requirement 1: When a line in Match is selected, identify ONLY its origin (subida) and destination (bajada) stops
    const isSelectedLineInMatch = Boolean(
      selectedLine &&
      destinationPoint &&
      matchedLineCodes &&
      matchedLineCodes.has(selectedLine.code.toUpperCase())
    );

    let matchOriginStopId: string | null = null;
    let matchDestStopId: string | null = null;

    if (isSelectedLineInMatch && selectedLine) {
      const lineEta = matchedLineETAs?.find(
        (e) => e.lineCode.toUpperCase() === selectedLine.code.toUpperCase()
      );
      if (lineEta) {
        matchOriginStopId = lineEta.originStopId;
        matchDestStopId = lineEta.destStopId;
      } else {
        const lineStopsOrigin = stops.filter(
          (s) =>
            (s.lines.includes(selectedLine.code) || (selectedLine.stops && selectedLine.stops.includes(s.id))) &&
            (originLat !== undefined && originLng !== undefined
              ? getDistanceMeters(originLat, originLng, s.lat, s.lng) <= searchRadius * 1.5
              : false)
        );
        const lineStopsDest = stops.filter(
          (s) =>
            (s.lines.includes(selectedLine.code) || (selectedLine.stops && selectedLine.stops.includes(s.id))) &&
            (destinationPoint
              ? getDistanceMeters(destinationPoint.lat, destinationPoint.lng, s.lat, s.lng) <= searchRadius * 1.5
              : false)
        );

        let bestOrig = lineStopsOrigin.find(
          (s) => stopMatchRoles?.get(s.id) === 'outbound_origin' || stopMatchRoles?.get(s.id) === 'both'
        );
        if (!bestOrig) bestOrig = lineStopsOrigin[0];
        matchOriginStopId = bestOrig?.id ?? null;

        let bestDest = lineStopsDest.find(
          (s) => stopMatchRoles?.get(s.id) === 'outbound_dest' || stopMatchRoles?.get(s.id) === 'both'
        );
        if (!bestDest) bestDest = lineStopsDest[0];
        matchDestStopId = bestDest?.id ?? null;
      }
    }

    const stopsToRender: {
      stop: BusStop;
      isWithinOrigin: boolean;
      isWithinDest: boolean;
      isSelected: boolean;
      isMatch: boolean;
    }[] = [];

    for (const stop of stops) {
      const isSelected = selectedStop?.id === stop.id;
      const isStopOnSelectedLine = selectedLine && (
        selectedLine.stops.includes(stop.id) ||
        selectedLine.stops.includes(stop.code) ||
        selectedLine.stops.includes(`stop-${stop.code}`) ||
        stop.lines.includes(selectedLine.code)
      );
      const isMatchKeyStop = isSelectedLineInMatch && (stop.id === matchOriginStopId || stop.id === matchDestStopId);

      let isWithinOrigin = false;
      if (originLat !== undefined && originLng !== undefined) {
        const distMeters = getDistanceMeters(originLat, originLng, stop.lat, stop.lng);
        isWithinOrigin = distMeters <= searchRadius;
      }

      let isWithinDest = false;
      if (destinationPoint) {
        const distDest = getDistanceMeters(destinationPoint.lat, destinationPoint.lng, stop.lat, stop.lng);
        isWithinDest = distDest <= searchRadius;
      }

      const isMatch = Boolean(
        matchedLineCodes &&
        matchedLineCodes.size > 0 &&
        stop.lines.some((l) => matchedLineCodes.has(l.toUpperCase()))
      );

      const matchRole = stopMatchRoles?.get(stop.id);
      const isTransferStop = highlightedTransferStopIds?.has(stop.id);

      // Requirement 6: When in match mode, filter out redundant consecutive stops
      // to keep ONLY the single closest stop for IDA and single closest stop for VUELTA per line
      if (
        destinationPoint &&
        matchedLineCodes &&
        matchedLineCodes.size > 0 &&
        allowedMatchStopIds &&
        allowedMatchStopIds.size > 0 &&
        matchRole &&
        !allowedMatchStopIds.has(stop.id) &&
        !isSelected &&
        !(isSelectedLineInMatch ? isMatchKeyStop : isStopOnSelectedLine) &&
        !isTransferStop
      ) {
        continue;
      }

      // Always include selected stop, key match stops (or stops on selected line outside match), or within either origin or destination radius
      if (isSelected || (isSelectedLineInMatch ? isMatchKeyStop : isStopOnSelectedLine) || isWithinOrigin || isWithinDest || isTransferStop) {
        stopsToRender.push({ stop, isWithinOrigin, isWithinDest, isSelected, isMatch });
        continue;
      }

      // Include viewport stops if zoomed in (up to 350)
      if (paddedBounds && paddedBounds.contains([stop.lat, stop.lng])) {
        if (mapZoom >= 14 && stopsToRender.length < 350) {
          stopsToRender.push({ stop, isWithinOrigin: false, isWithinDest: false, isSelected: false, isMatch });
        } else if (mapZoom < 14 && stopsToRender.length < 60) {
          stopsToRender.push({ stop, isWithinOrigin: false, isWithinDest: false, isSelected: false, isMatch });
        }
      }
    }

    stopsToRender.forEach(({ stop, isWithinOrigin, isWithinDest, isSelected, isMatch }) => {
      const isAnyActive = isWithinOrigin || isWithinDest;
      const matchRole = stopMatchRoles?.get(stop.id);
      const isTransferStop = highlightedTransferStopIds?.has(stop.id);
      const isMetro = stop.transportType === 'metro' || stop.lines.some((l) => l.startsWith('L') || l === 'FM');
      const isStopOnSelectedLine = selectedLine && (
        selectedLine.stops.includes(stop.id) ||
        selectedLine.stops.includes(stop.code) ||
        selectedLine.stops.includes(`stop-${stop.code}`) ||
        stop.lines.includes(selectedLine.code)
      );
      const isMatchKeyStop = isSelectedLineInMatch && (stop.id === matchOriginStopId || stop.id === matchDestStopId);

      // Determine colors and badges based on match direction (Ida vs Vuelta)
      let roleBorderClass = '';
      let roleBadgeText = stop.code;
      let roleBadgeClass = 'bg-slate-950/80 text-slate-400 border border-slate-800';
      let roleIcon = isMetro ? '🚇' : (
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 6v6"></path>
          <path d="M15 6v6"></path>
          <path d="M2 12h19.6"></path>
          <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"></path>
          <circle cx="7" cy="18" r="2"></circle>
          <circle cx="15" cy="18" r="2"></circle>
        </svg>
      );

      // Requirement 1: When a line in match is selected, ONLY highlight origin and destination stops
      if (isSelected) {
        roleBorderClass = 'bg-amber-500 border-white ring-4 ring-amber-500/40 scale-125 z-50 text-slate-950 font-bold';
        roleBadgeClass = 'bg-amber-500 text-slate-950 font-black';
      } else if (isSelectedLineInMatch) {
        // When a line in Match is selected: ONLY the origin (subida) and destination (bajada) stops are highlighted!
        if (isMatchKeyStop) {
          const isOrigin = stop.id === matchOriginStopId;
          roleBorderClass = isOrigin
            ? 'bg-slate-950 border-emerald-400 text-emerald-300 ring-4 ring-emerald-400 ring-offset-2 ring-offset-slate-950 scale-125 z-[900] shadow-2xl font-black animate-pulse'
            : 'bg-slate-950 border-purple-400 text-purple-200 ring-4 ring-purple-400 ring-offset-2 ring-offset-slate-950 scale-125 z-[900] shadow-2xl font-black animate-pulse';
          roleBadgeClass = isOrigin
            ? 'bg-emerald-500 text-slate-950 font-black border border-white shadow-lg'
            : 'bg-purple-600 text-white font-black border border-white shadow-lg';
          roleBadgeText = isOrigin
            ? `🟢 SUBIDA • ${selectedLine?.code}`
            : `🎯 BAJADA • ${selectedLine?.code}`;
        } else {
          // All other stops on the line or map remain completely muted/dimmed
          roleBorderClass = 'bg-slate-900 border-slate-700/80 text-slate-500';
          roleBadgeClass = 'bg-slate-950/80 text-slate-500 border border-slate-800 text-[9px]';
          roleBadgeText = stop.code;
        }
      } else if (isStopOnSelectedLine) {
        roleBorderClass = 'bg-amber-400 border-white text-slate-950 ring-4 ring-amber-300 ring-offset-2 ring-offset-slate-950 scale-125 z-[800] shadow-2xl font-black animate-pulse';
        roleBadgeClass = 'bg-amber-400 text-slate-950 font-black border border-slate-950 shadow-lg';
        roleBadgeText = `${selectedLine?.code || stop.code} • ${stop.name.slice(0, 14)}`;
      } else if (isTransferStop) {
        roleBorderClass = 'bg-indigo-950 border-indigo-300 text-indigo-200 ring-4 ring-indigo-500/80 scale-125 shadow-lg shadow-indigo-500/40';
        roleBadgeClass = 'bg-indigo-600 text-white font-black border border-indigo-400';
        roleBadgeText = 'TRANSBORDO';
      } else if (matchRole === 'outbound_origin') {
        // PARADA DE SUBIDA HACIA DESTINO (IDA) - Verde Esmeralda
        roleBorderClass = 'bg-slate-950 border-emerald-400 text-emerald-300 ring-4 ring-emerald-500/70 scale-110 shadow-lg shadow-emerald-500/30';
        roleBadgeClass = 'bg-emerald-500 text-slate-950 font-extrabold border border-emerald-300 shadow';
        roleBadgeText = `${stop.code} • IDA ➔`;
      } else if (matchRole === 'outbound_dest') {
        // PARADA DE LLEGADA EN DESTINO (IDA) - Verde Esmeralda
        roleBorderClass = 'bg-emerald-950 border-emerald-400 text-emerald-200 ring-4 ring-emerald-500/70 scale-110 shadow-lg shadow-emerald-500/30';
        roleBadgeClass = 'bg-emerald-500 text-slate-950 font-extrabold border border-emerald-300 shadow';
        roleBadgeText = `${stop.code} • LLEGADA 🎯`;
      } else if (matchRole === 'return_dest') {
        // PARADA DE SUBIDA PARA REGRESAR (VUELTA) - Coral / Rose
        roleBorderClass = 'bg-slate-950 border-rose-400 text-rose-300 ring-4 ring-rose-500/70 scale-110 shadow-lg shadow-rose-500/30';
        roleBadgeClass = 'bg-rose-500 text-white font-extrabold border border-rose-300 shadow';
        roleBadgeText = `${stop.code} • VUELTA ↩`;
      } else if (matchRole === 'return_origin') {
        // PARADA DE LLEGADA DE VUELTA EN ORIGEN - Coral / Rose
        roleBorderClass = 'bg-rose-950 border-rose-400 text-rose-200 ring-4 ring-rose-500/70 scale-110 shadow-lg shadow-rose-500/30';
        roleBadgeClass = 'bg-rose-500 text-white font-extrabold border border-rose-300 shadow';
        roleBadgeText = `${stop.code} • LLEGADA 🏠`;
      } else if (matchRole === 'both') {
        // PARADA CON DOBLE SENTIDO (IDA Y VUELTA)
        roleBorderClass = 'bg-slate-950 border-amber-400 text-amber-300 ring-4 ring-amber-400/80 scale-115 shadow-lg shadow-amber-400/30';
        roleBadgeClass = 'bg-gradient-to-r from-emerald-500 to-rose-500 text-white font-extrabold border border-amber-300 shadow';
        roleBadgeText = `${stop.code} • IDA/VTA`;
      } else if (isMatch && isAnyActive) {
        roleBorderClass = 'bg-slate-900 border-amber-400 text-amber-300 ring-4 ring-amber-400/40 scale-110';
        roleBadgeClass = 'bg-amber-500/90 text-slate-950 border border-amber-300 font-extrabold';
      } else if (isWithinDest) {
        roleBorderClass = 'bg-purple-950 border-purple-400 text-purple-200 ring-2 ring-purple-500/30';
        roleBadgeClass = 'bg-purple-900/90 text-purple-200 border border-purple-500/80';
      } else if (isWithinOrigin) {
        roleBorderClass = 'bg-slate-800 border-blue-400 text-white hover:border-amber-400 ring-2 ring-blue-500/20';
        roleBadgeClass = 'bg-slate-900/90 text-slate-200 border border-slate-700/80';
      } else {
        roleBorderClass = 'bg-slate-900 border-slate-600 text-slate-400 hover:border-blue-400';
      }

      // Opacity: If a line is selected, dim other stops so the selected line or key match stops stand out
      const opacityClass = selectedLine
        ? (isSelectedLineInMatch ? isMatchKeyStop : isStopOnSelectedLine) || isSelected || isTransferStop
          ? 'opacity-100 z-40'
          : 'opacity-20 hover:opacity-80'
        : isAnyActive || isTransferStop
        ? 'opacity-100'
        : 'opacity-40 hover:opacity-90';

      // Custom Stop Pin
      const stopIcon = L.divIcon({
        className: 'custom-stop-marker',
        html: `
          <div class="cursor-pointer transition-transform duration-200 hover:scale-110 flex flex-col items-center group ${opacityClass}">
            <div class="flex items-center justify-center w-7 h-7 rounded-full shadow-md border-2 transition-all ${roleBorderClass}">
              ${
                matchRole === 'outbound_origin'
                  ? '<span class="text-xs font-black text-emerald-300">➔</span>'
                  : matchRole === 'outbound_dest'
                  ? '<span class="text-xs">🎯</span>'
                  : matchRole === 'return_dest'
                  ? '<span class="text-xs font-black text-rose-300">↩</span>'
                  : matchRole === 'return_origin'
                  ? '<span class="text-xs">🏠</span>'
                  : matchRole === 'both'
                  ? '<span class="text-xs font-black text-amber-300">⇄</span>'
                  : isTransferStop
                  ? '<span class="text-xs font-black text-indigo-200">🔄</span>'
                  : isMetro
                  ? '<span class="text-xs">🚇</span>'
                  : isWithinDest
                  ? '<span class="text-[11px]">🎯</span>'
                  : `
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 ${isSelected || (!isSelectedLineInMatch && isStopOnSelectedLine) ? 'text-slate-950 font-bold' : isWithinOrigin ? 'text-blue-300' : 'text-slate-400'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M8 6v6"></path>
                  <path d="M15 6v6"></path>
                  <path d="M2 12h19.6"></path>
                  <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"></path>
                  <circle cx="7" cy="18" r="2"></circle>
                  <circle cx="15" cy="18" r="2"></circle>
                </svg>
              `
              }
            </div>
            <div class="mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tight shadow-sm whitespace-nowrap ${roleBadgeClass}">
              ${roleBadgeText}
            </div>
          </div>
        `,
        iconSize: [36, 48],
        iconAnchor: [18, 24],
      });

      const marker = L.marker([stop.lat, stop.lng], {
        icon: stopIcon,
        zIndexOffset: isSelected
          ? 950
          : isMatchKeyStop
          ? 900
          : (!isSelectedLineInMatch && isStopOnSelectedLine)
          ? 800
          : (!isSelectedLineInMatch && matchRole)
          ? 650
          : isTransferStop
          ? 600
          : isAnyActive
          ? 300
          : 100,
      });

      // Bind informative popup explaining the stop role in match mode
      let matchDesc = '';
      if (matchRole === 'outbound_origin') {
        matchDesc = '<div class="mt-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] border border-emerald-500/40">🟢 Parada de subida de IDA hacia el destino</div>';
      } else if (matchRole === 'outbound_dest') {
        matchDesc = '<div class="mt-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] border border-emerald-500/40">🎯 Parada de bajada / llegada en el destino</div>';
      } else if (matchRole === 'return_dest') {
        matchDesc = '<div class="mt-1 px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-800 dark:text-rose-300 font-bold text-[10px] border border-rose-500/40">🔴 Parada de subida de VUELTA hacia tu origen</div>';
      } else if (matchRole === 'return_origin') {
        matchDesc = '<div class="mt-1 px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-800 dark:text-rose-300 font-bold text-[10px] border border-rose-500/40">🏠 Parada de llegada de regreso en tu origen</div>';
      } else if (matchRole === 'both') {
        matchDesc = '<div class="mt-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold text-[10px] border border-amber-500/40">✨ Parada con doble sentido (Ida y Vuelta)</div>';
      } else if (isTransferStop) {
        matchDesc = '<div class="mt-1 px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-800 dark:text-indigo-300 font-bold text-[10px] border border-indigo-500/40">🔄 Estación propuesta de transbordo</div>';
      }

      marker.bindPopup(`
        <div class="p-1 font-sans text-xs text-slate-800">
          <div class="font-bold flex items-center gap-1">
            <span>${isMetro ? '🚇' : '🚏'}</span>
            <span>${stop.name}</span>
          </div>
          <div class="text-[11px] text-slate-500">Código: #${stop.code} • Líneas: <strong>${stop.lines.join(', ')}</strong></div>
          ${matchDesc}
        </div>
      `);

      marker.on('click', () => {
        onSelectStop(stop);
      });

      group.addLayer(marker);
    });
  }, [stops, selectedStop, selectedLine, onSelectStop, userLocation, center, searchRadius, mapViewBounds, mapZoom, destinationPoint, matchedLineCodes, stopMatchRoles, highlightedTransferStopIds, allowedMatchStopIds, matchedLineETAs]);

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

  // Requirement 1: D3 Trajectory Overlay: Draws smooth, animated journey trajectories connecting origin and destination stops
  // when a Match or Transfer route is selected
  useEffect(() => {
    const map = mapInstanceRef.current;
    const d3Svg = d3SvgRef.current;
    const container = d3ContainerRef.current;
    if (!map || !d3Svg || !container) return;

    // Helper: Leaflet projection to pixel coordinates
    const project = (lat: number, lng: number): [number, number] => {
      const pt = map.latLngToLayerPoint(new L.LatLng(lat, lng));
      return [pt.x, pt.y];
    };

    // Keep SVG overlay viewport aligned with Leaflet's bounds
    const updateOverlayBounds = () => {
      const bounds = map.getBounds();
      const nw = map.latLngToLayerPoint(bounds.getNorthWest());
      const se = map.latLngToLayerPoint(bounds.getSouthEast());
      const pad = 400;

      const w = Math.max(100, se.x - nw.x + pad * 2);
      const h = Math.max(100, se.y - nw.y + pad * 2);
      const left = nw.x - pad;
      const top = nw.y - pad;

      d3.select(d3Svg)
        .attr('width', w)
        .attr('height', h)
        .style('left', `${left}px`)
        .style('top', `${top}px`);

      container.attr('transform', `translate(${-left}, ${-top})`);
    };

    const originLat = userLocation?.lat ?? center?.[0] ?? 41.3879;
    const originLng = userLocation?.lng ?? center?.[1] ?? 2.1699;

    const isMatchLineSelected = Boolean(
      selectedLine &&
      destinationPoint &&
      matchedLineCodes &&
      matchedLineCodes.has(selectedLine.code.toUpperCase())
    );

    const isTransferActive = Boolean(selectedTransfer && destinationPoint);

    // If neither match nor transfer route is selected, clear D3 overlay
    if (!isMatchLineSelected && !isTransferActive) {
      container.selectAll('*').remove();
      return;
    }

    const drawD3Trajectory = () => {
      updateOverlayBounds();
      container.selectAll('*').remove();

      // D3 Path Generators
      const lineGen = d3
        .line<[number, number]>()
        .x((d) => d[0])
        .y((d) => d[1])
        .curve(d3.curveCatmullRom.alpha(0.5));

      const walkGen = d3
        .line<[number, number]>()
        .x((d) => d[0])
        .y((d) => d[1])
        .curve(d3.curveBasis);

      // CASE 1: Transfer Route Selected
      if (isTransferActive && selectedTransfer && destinationPoint) {
        const t = selectedTransfer;
        const ptOrigin = project(originLat, originLng);
        const ptStop1 = project(t.firstStop.lat, t.firstStop.lng);
        const ptT1 = project(t.transferStopFirst.lat, t.transferStopFirst.lng);
        const ptT2 = project(t.transferStopSecond.lat, t.transferStopSecond.lng);
        const ptDestStop = project(t.destStop.lat, t.destStop.lng);
        const ptDest = project(destinationPoint.lat, destinationPoint.lng);

        // Subpaths along actual bus/metro routes
        const getSubPath = (line: BusLine, fromStop: BusStop, toStop: BusStop): [number, number][] => {
          if (!line.path || line.path.length < 2) {
            return [
              [fromStop.lat, fromStop.lng],
              [toStop.lat, toStop.lng],
            ];
          }
          let idxFrom = 0;
          let minDFrom = Infinity;
          let idxTo = 0;
          let minDTo = Infinity;

          line.path.forEach((p, i) => {
            const dF = Math.hypot(p[0] - fromStop.lat, p[1] - fromStop.lng);
            if (dF < minDFrom) {
              minDFrom = dF;
              idxFrom = i;
            }
            const dT = Math.hypot(p[0] - toStop.lat, p[1] - toStop.lng);
            if (dT < minDTo) {
              minDTo = dT;
              idxTo = i;
            }
          });

          let segment: [number, number][];
          if (idxFrom <= idxTo) {
            segment = line.path.slice(idxFrom, idxTo + 1);
          } else {
            segment = line.path.slice(idxTo, idxFrom + 1).reverse();
          }

          if (segment.length < 2) {
            segment = [
              [fromStop.lat, fromStop.lng],
              [toStop.lat, toStop.lng],
            ];
          }
          return segment;
        };

        const leg1Coords = getSubPath(t.firstLine, t.firstStop, t.transferStopFirst);
        const leg2Coords = getSubPath(t.secondLine, t.transferStopSecond, t.destStop);

        // 1. Walk Leg: Origin -> First Stop (dashed cyan)
        const walk1Points: [number, number][] = [
          ptOrigin,
          [(ptOrigin[0] + ptStop1[0]) / 2 + (ptOrigin[1] - ptStop1[1]) * 0.1, (ptOrigin[1] + ptStop1[1]) / 2],
          ptStop1,
        ];
        container
          .append('path')
          .attr('d', walkGen(walk1Points) || '')
          .attr('fill', 'none')
          .attr('stroke', '#06b6d4')
          .attr('stroke-width', 3)
          .attr('stroke-dasharray', '5 5')
          .attr('stroke-linecap', 'round');

        // 2. Transit Leg 1: First Line (Glow + Solid Line + Animated Flow)
        const leg1Pixels = leg1Coords.map((c) => project(c[0], c[1]));
        const leg1PathStr = lineGen(leg1Pixels) || '';

        container
          .append('path')
          .attr('d', leg1PathStr)
          .attr('fill', 'none')
          .attr('stroke', t.firstLine.color)
          .attr('stroke-width', 10)
          .attr('stroke-opacity', 0.35)
          .attr('filter', 'url(#d3-transit-glow)');

        container
          .append('path')
          .attr('d', leg1PathStr)
          .attr('fill', 'none')
          .attr('stroke', t.firstLine.color)
          .attr('stroke-width', 5.5)
          .attr('stroke-linecap', 'round');

        container
          .append('path')
          .attr('d', leg1PathStr)
          .attr('fill', 'none')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 3)
          .attr('stroke-dasharray', '12 12')
          .attr('class', 'd3-flow-path')
          .attr('stroke-opacity', 0.95);

        // 3. Transfer Walk Connection: Transfer Stop 1 -> Transfer Stop 2 (Dashed Indigo Arc)
        const transferPoints: [number, number][] = [
          ptT1,
          [(ptT1[0] + ptT2[0]) / 2, (ptT1[1] + ptT2[1]) / 2 - 20],
          ptT2,
        ];
        container
          .append('path')
          .attr('d', walkGen(transferPoints) || '')
          .attr('fill', 'none')
          .attr('stroke', '#6366f1')
          .attr('stroke-width', 4)
          .attr('stroke-dasharray', '6 6')
          .attr('stroke-linecap', 'round');

        // 4. Transit Leg 2: Second Line
        const leg2Pixels = leg2Coords.map((c) => project(c[0], c[1]));
        const leg2PathStr = lineGen(leg2Pixels) || '';

        container
          .append('path')
          .attr('d', leg2PathStr)
          .attr('fill', 'none')
          .attr('stroke', t.secondLine.color)
          .attr('stroke-width', 10)
          .attr('stroke-opacity', 0.35)
          .attr('filter', 'url(#d3-transit-glow)');

        container
          .append('path')
          .attr('d', leg2PathStr)
          .attr('fill', 'none')
          .attr('stroke', t.secondLine.color)
          .attr('stroke-width', 5.5)
          .attr('stroke-linecap', 'round');

        container
          .append('path')
          .attr('d', leg2PathStr)
          .attr('fill', 'none')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 3)
          .attr('stroke-dasharray', '12 12')
          .attr('class', 'd3-flow-path')
          .attr('stroke-opacity', 0.95);

        // 5. Walk Leg: Dest Stop -> Destination Point (Dashed Purple)
        const walk2Points: [number, number][] = [
          ptDestStop,
          [(ptDestStop[0] + ptDest[0]) / 2, (ptDestStop[1] + ptDest[1]) / 2],
          ptDest,
        ];
        container
          .append('path')
          .attr('d', walkGen(walk2Points) || '')
          .attr('fill', 'none')
          .attr('stroke', '#a855f7')
          .attr('stroke-width', 3)
          .attr('stroke-dasharray', '5 5')
          .attr('stroke-linecap', 'round');

        // Helper: Node markers
        const drawNode = (pt: [number, number], color: string, label: string, badgeBg = '#0f172a') => {
          const gNode = container.append('g').attr('transform', `translate(${pt[0]}, ${pt[1]})`);
          // Pulsing halo
          gNode
            .append('circle')
            .attr('r', 16)
            .attr('fill', color)
            .attr('fill-opacity', 0.25)
            .attr('stroke', color)
            .attr('stroke-width', 1.5)
            .attr('class', 'd3-pulse-node');
          // Solid center
          gNode
            .append('circle')
            .attr('r', 7)
            .attr('fill', color)
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 2.5);
          // Label pill
          const textW = label.length * 6.5 + 16;
          gNode
            .append('rect')
            .attr('x', -textW / 2)
            .attr('y', -30)
            .attr('width', textW)
            .attr('height', 18)
            .attr('rx', 9)
            .attr('fill', badgeBg)
            .attr('stroke', color)
            .attr('stroke-width', 1.5);
          gNode
            .append('text')
            .attr('x', 0)
            .attr('y', -18)
            .attr('text-anchor', 'middle')
            .attr('fill', '#ffffff')
            .attr('font-size', '9px')
            .attr('font-weight', 'bold')
            .text(label);
        };

        drawNode(ptStop1, '#10b981', `Subida: ${t.firstStop.name} (${t.firstLine.code})`, '#064e3b');
        drawNode(ptT1, '#6366f1', `Transbordo: ${t.transferStationName}`, '#312e81');
        drawNode(ptDestStop, '#a855f7', `Llegada: ${t.destStop.name} (${t.secondLine.code})`, '#581c87');
      }

      // CASE 2: Match Direct Line Selected
      else if (isMatchLineSelected && selectedLine && destinationPoint) {
        // Find best origin boarding stop and destination arrival stop for this line
        const originLineStops = stops.filter(
          (s) =>
            (s.lines.includes(selectedLine.code) || (selectedLine.stops && selectedLine.stops.includes(s.id))) &&
            Math.hypot(s.lat - originLat, s.lng - originLng) <= (searchRadius * 1.5) / 111320
        );
        const destLineStops = stops.filter(
          (s) =>
            (s.lines.includes(selectedLine.code) || (selectedLine.stops && selectedLine.stops.includes(s.id))) &&
            Math.hypot(s.lat - destinationPoint.lat, s.lng - destinationPoint.lng) <= (searchRadius * 1.5) / 111320
        );

        let origStop = originLineStops.find(
          (s) => stopMatchRoles?.get(s.id) === 'outbound_origin' || stopMatchRoles?.get(s.id) === 'both'
        );
        if (!origStop) origStop = originLineStops[0];

        let destStop = destLineStops.find(
          (s) => stopMatchRoles?.get(s.id) === 'outbound_dest' || stopMatchRoles?.get(s.id) === 'both'
        );
        if (!destStop) destStop = destLineStops[0];

        if (!origStop || !destStop) return;

        const ptOrigin = project(originLat, originLng);
        const ptStopOrig = project(origStop.lat, origStop.lng);
        const ptStopDest = project(destStop.lat, destStop.lng);
        const ptDest = project(destinationPoint.lat, destinationPoint.lng);

        // Extract subpath along line path
        let subPathCoords: [number, number][] = [
          [origStop.lat, origStop.lng],
          [destStop.lat, destStop.lng],
        ];

        if (selectedLine.path && selectedLine.path.length >= 2) {
          let idxO = 0;
          let minDO = Infinity;
          let idxD = 0;
          let minDD = Infinity;

          selectedLine.path.forEach((p, i) => {
            const dO = Math.hypot(p[0] - origStop!.lat, p[1] - origStop!.lng);
            if (dO < minDO) {
              minDO = dO;
              idxO = i;
            }
            const dD = Math.hypot(p[0] - destStop!.lat, p[1] - destStop!.lng);
            if (dD < minDD) {
              minDD = dD;
              idxD = i;
            }
          });

          if (idxO <= idxD) {
            subPathCoords = [
              [origStop.lat, origStop.lng],
              ...selectedLine.path.slice(idxO, idxD + 1),
              [destStop.lat, destStop.lng],
            ];
          } else {
            subPathCoords = [
              [origStop.lat, origStop.lng],
              ...selectedLine.path.slice(idxD, idxO + 1).reverse(),
              [destStop.lat, destStop.lng],
            ];
          }
        }

        // 1. Walk leg: Origin -> Boarding Stop (dashed cyan)
        const walk1Points: [number, number][] = [
          ptOrigin,
          [(ptOrigin[0] + ptStopOrig[0]) / 2, (ptOrigin[1] + ptStopOrig[1]) / 2],
          ptStopOrig,
        ];
        container
          .append('path')
          .attr('d', walkGen(walk1Points) || '')
          .attr('fill', 'none')
          .attr('stroke', '#06b6d4')
          .attr('stroke-width', 3)
          .attr('stroke-dasharray', '5 5')
          .attr('stroke-linecap', 'round');

        // 2. Main Match Transit Leg (Glow + Colored Stroke + Animated Dash Flow)
        const mainPixels = subPathCoords.map((c) => project(c[0], c[1]));
        const mainPathStr = lineGen(mainPixels) || '';

        // Glowing outer halo
        container
          .append('path')
          .attr('d', mainPathStr)
          .attr('fill', 'none')
          .attr('stroke', selectedLine.color || '#10b981')
          .attr('stroke-width', 11)
          .attr('stroke-opacity', 0.4)
          .attr('filter', 'url(#d3-transit-glow)');

        // Solid route line
        container
          .append('path')
          .attr('d', mainPathStr)
          .attr('fill', 'none')
          .attr('stroke', selectedLine.color || '#10b981')
          .attr('stroke-width', 5.5)
          .attr('stroke-linecap', 'round');

        // Flowing animated dash
        container
          .append('path')
          .attr('d', mainPathStr)
          .attr('fill', 'none')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 3)
          .attr('stroke-dasharray', '12 12')
          .attr('class', 'd3-flow-path')
          .attr('stroke-opacity', 0.95);

        // 3. Walk leg: Arrival Stop -> Destination (dashed purple)
        const walk2Points: [number, number][] = [
          ptStopDest,
          [(ptStopDest[0] + ptDest[0]) / 2, (ptStopDest[1] + ptDest[1]) / 2],
          ptDest,
        ];
        container
          .append('path')
          .attr('d', walkGen(walk2Points) || '')
          .attr('fill', 'none')
          .attr('stroke', '#a855f7')
          .attr('stroke-width', 3)
          .attr('stroke-dasharray', '5 5')
          .attr('stroke-linecap', 'round');

        // 4. Origin & Destination Node Pins
        const drawPin = (pt: [number, number], color: string, title: string, bg: string) => {
          const gNode = container.append('g').attr('transform', `translate(${pt[0]}, ${pt[1]})`);
          gNode
            .append('circle')
            .attr('r', 18)
            .attr('fill', color)
            .attr('fill-opacity', 0.25)
            .attr('stroke', color)
            .attr('stroke-width', 2)
            .attr('class', 'd3-pulse-node');
          gNode
            .append('circle')
            .attr('r', 8)
            .attr('fill', color)
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 2.5);
          const textW = title.length * 6.5 + 16;
          gNode
            .append('rect')
            .attr('x', -textW / 2)
            .attr('y', -32)
            .attr('width', textW)
            .attr('height', 20)
            .attr('rx', 10)
            .attr('fill', bg)
            .attr('stroke', color)
            .attr('stroke-width', 1.5);
          gNode
            .append('text')
            .attr('x', 0)
            .attr('y', -19)
            .attr('text-anchor', 'middle')
            .attr('fill', '#ffffff')
            .attr('font-size', '10px')
            .attr('font-weight', 'bold')
            .text(title);
        };

        drawPin(ptStopOrig, '#10b981', `Subida: ${origStop.name} (${selectedLine.code})`, '#064e3b');
        drawPin(ptStopDest, '#a855f7', `Llegada: ${destStop.name} (${selectedLine.code})`, '#581c87');
      }
    };

    drawD3Trajectory();

    // Re-draw and keep in sync on any Leaflet zoom / move / pan
    map.on('move', drawD3Trajectory);
    map.on('zoom', drawD3Trajectory);
    map.on('viewreset', drawD3Trajectory);
    map.on('zoomend', drawD3Trajectory);

    return () => {
      map.off('move', drawD3Trajectory);
      map.off('zoom', drawD3Trajectory);
      map.off('viewreset', drawD3Trajectory);
      map.off('zoomend', drawD3Trajectory);
      container.selectAll('*').remove();
    };
  }, [
    selectedLine,
    selectedTransfer,
    matchedLineCodes,
    destinationPoint,
    userLocation,
    center,
    stops,
    searchRadius,
    stopMatchRoles,
  ]);

  // Auto-fit map bounds when selecting a Match or Transfer route to frame the whole trajectory
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const paddingBottom = isMobile ? Math.round(window.innerHeight * 0.48) : 40;
    const fitOptions: L.FitBoundsOptions = {
      paddingTopLeft: [30, 30],
      paddingBottomRight: [30, paddingBottom],
      animate: true,
      duration: 0.8,
    };

    if (selectedTransfer && destinationPoint) {
      const bounds = L.latLngBounds([
        [selectedTransfer.firstStop.lat, selectedTransfer.firstStop.lng],
        [selectedTransfer.transferStopFirst.lat, selectedTransfer.transferStopFirst.lng],
        [selectedTransfer.destStop.lat, selectedTransfer.destStop.lng],
        [destinationPoint.lat, destinationPoint.lng],
      ]);
      map.fitBounds(bounds.pad(0.15), fitOptions);
    } else if (
      selectedLine &&
      destinationPoint &&
      matchedLineCodes &&
      matchedLineCodes.has(selectedLine.code.toUpperCase())
    ) {
      const originLat = userLocation?.lat ?? center?.[0] ?? 41.3879;
      const originLng = userLocation?.lng ?? center?.[1] ?? 2.1699;
      const bounds = L.latLngBounds([
        [originLat, originLng],
        [destinationPoint.lat, destinationPoint.lng],
      ]);
      map.fitBounds(bounds.pad(0.2), fitOptions);
    }
  }, [selectedTransfer, selectedLine, destinationPoint, matchedLineCodes]);

  // Update Moving Live Buses with on-route coordinates and Match highlights
  useEffect(() => {
    const group = busesLayerRef.current;
    if (!group) return;

    group.clearLayers();

    buses.forEach((bus) => {
      const line = lines.find((l) => l.code === bus.lineCode);
      const color = line?.color || '#2563eb';
      const isMatched = bus.isMatch || Boolean(matchedLineCodes?.has(bus.lineCode.toUpperCase()));
      const isMetro = bus.transportType === 'metro' || bus.lineCode.startsWith('L') || bus.lineCode === 'FM' || line?.transportType === 'metro';

      // Live vehicle icon with directional rotation and Match highlight
      const busIcon = L.divIcon({
        className: 'custom-live-bus-marker',
        html: `
          <div class="relative w-12 h-10 flex items-center justify-center transition-all duration-700 ease-linear">
            <!-- Pulsing outer ring -->
            ${isMatched ? `<div class="absolute w-9 h-9 rounded-full bg-amber-400 opacity-60 animate-ping pointer-events-none"></div>` : ''}

            <!-- Directional compass pointer: spins strictly around the vehicle center and points along heading -->
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none" style="transform: rotate(${bus.heading}deg); transform-origin: 50% 50%;">
              <div class="absolute -top-2.5 flex items-center justify-center">
                <svg viewBox="0 0 24 24" class="w-4 h-4 ${isMatched ? 'text-amber-300 fill-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.95)]' : 'text-white fill-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]'}">
                  <path d="M12 2L4.5 20.5l7.5-4 7.5 4L12 2z"/>
                </svg>
              </div>
            </div>

            ${
              isMatched
                ? `<div class="absolute -top-5 px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-black text-[9px] tracking-wider shadow border border-white z-30 pointer-events-none">MATCH</div>`
                : ''
            }

            <!-- Main Vehicle Pill -->
            <div class="relative z-20 flex items-center gap-1 px-1.5 py-0.5 rounded-full shadow-lg border-2 ${isMatched ? 'border-amber-300 ring-2 ring-amber-400/60' : 'border-white'} text-white font-extrabold text-[11px] leading-tight select-none" style="background-color: ${color}">
              <span class="text-[10px]">${isMetro ? '🚇' : isMatched ? '✨' : '🚌'}</span>
              <span>${bus.lineCode}</span>
            </div>
          </div>
        `,
        iconSize: [48, 40],
        iconAnchor: [24, 20],
      });

      const marker = L.marker([bus.lat, bus.lng], {
        icon: busIcon,
        zIndexOffset: isMatched ? 750 : 600,
      });

      marker.bindPopup(`
        <div class="p-1 font-sans text-xs text-slate-800">
          <div class="flex items-center gap-1.5 font-bold" style="color: ${color}">
            <span class="px-1.5 py-0.5 rounded text-white text-[10px]" style="background-color: ${color}">${isMetro ? '🚇 ' : ''}${bus.lineCode}</span>
            <span>${line?.name || (isMetro ? 'Línea de Metro' : 'Línea de Autobús')}</span>
          </div>

          ${
            isMatched
              ? `<div class="mt-1 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-800 font-bold text-[10px] flex items-center gap-1">
                   <span>✨</span>
                   <span>Match directo Origen ⇄ Destino</span>
                 </div>`
              : ''
          }

          <div class="mt-1 text-[11px] text-slate-600">
            <div>Identificador: <strong>${bus.plate}</strong></div>
            <div>Rumbo: <strong>${Math.round(bus.heading)}°</strong> • Velocidad: <strong>${Math.round(bus.speedKmh)} km/h</strong></div>
            <div>Ocupación: <span class="capitalize font-semibold">${bus.occupancy === 'low' ? '🟢 Baja' : bus.occupancy === 'medium' ? '🟡 Media' : '🔴 Alta'}</span></div>
            <div>Accesibilidad: ${bus.isAccessible ? '♿ Sí (PMR)' : 'Estándar'}</div>
          </div>
        </div>
      `);

      group.addLayer(marker);
    });
  }, [buses, lines, matchedLineCodes]);

  // Center on selected stop when changed
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedStop) return;

    map.panTo([selectedStop.lat, selectedStop.lng], {
      animate: true,
      duration: 0.8,
    });
  }, [selectedStop]);

  // Direct, robust GPS recentering
  const handleRecenterClick = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    setIsLocating(true);

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setIsLocating(false);
          map.flyTo([pos.coords.latitude, pos.coords.longitude], 16, {
            animate: true,
            duration: 0.8,
          });
          onRecenter();
        },
        () => {
          setIsLocating(false);
          if (userLocation) {
            map.flyTo([userLocation.lat, userLocation.lng], 16, {
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
    <div className={`relative w-full h-full ${isSettingDestination ? 'cursor-crosshair' : ''}`}>
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

      {/* Network status pill (hidden while setting destination to prevent overlapping messages) */}
      {!isSettingDestination && (
        <div className="absolute top-4 left-4 z-[400] pointer-events-none hidden sm:block">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-700/70 text-xs text-slate-200 shadow-lg">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-semibold text-[11px]">
              Red TMB Barcelona Oficial
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
