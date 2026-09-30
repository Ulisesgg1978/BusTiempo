export interface BusStop {
  id: string;
  code: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  lines: string[];
  wheelchairAccessible: boolean;
  shelter: boolean;
  nextArrivals: Arrival[];
  transportType?: 'bus' | 'metro';
}

export interface BusLine {
  id: string;
  code: string;
  name: string;
  color: string;
  textColor: string;
  origin: string;
  destination: string;
  frequencyMinutes: number;
  stops: string[]; // stop IDs in order
  path: [number, number][]; // lat, lng coordinates
  transportType?: 'bus' | 'metro';
}

export interface LiveBus {
  id: string;
  lineCode: string;
  plate: string;
  lat: number;
  lng: number;
  heading: number;
  speedKmh: number;
  nextStopId: string;
  distanceToNextStopMeters: number;
  targetStopId?: string;
  occupancy: 'low' | 'medium' | 'high';
  isAccessible: boolean;
  pathIndex?: number;
  pathProgress?: number;
  isMatch?: boolean;
  transportType?: 'bus' | 'metro';
}

export interface TargetPoint {
  id?: string;
  lat: number;
  lng: number;
  name?: string;
  isFavorite?: boolean;
}

export interface RecentDestination {
  id: string;
  name: string;
  lat: number;
  lng: number;
  timestamp: number;
}

export interface DestinationFavorite {
  id: string;
  name: string;
  category: 'home' | 'work' | 'gym' | 'study' | 'health' | 'leisure' | 'shopping' | 'favorite' | 'custom';
  lat: number;
  lng: number;
  icon?: string;
  createdAt: number;
}

export type MatchStopRole =
  | 'outbound_origin' // Parada de origen de IDA (subes aquí hacia el destino)
  | 'outbound_dest'   // Parada de destino de IDA (bajas aquí al llegar)
  | 'return_dest'     // Parada de origen de VUELTA (subes en destino para regresar)
  | 'return_origin'   // Parada de destino de VUELTA (bajas en tu origen de vuelta)
  | 'both';           // Parada que sirve tanto para ida como para vuelta

export interface MatchedLineETA {
  lineCode: string;
  lineName: string;
  color: string;
  textColor: string;
  transportType: 'bus' | 'metro';
  originStopId: string;
  originStopName: string;
  destStopId: string;
  destStopName: string;
  nextArrivalMinutes: number;
  subsequentArrivalMinutes: number;
  direction: 'outbound' | 'return' | 'bidirectional';
  liveVehicleCount: number;
  // Desglose de tiempos para viaje puerta a puerta
  walkToOriginMinutes: number;   // Tiempo a pie hasta la parada de origen
  waitTimeMinutes: number;       // Tiempo de espera hasta que pase el transporte
  transitTimeMinutes: number;    // Tiempo en tránsito hasta la parada de destino
  walkFromDestMinutes: number;   // Tiempo a pie desde la parada de bajada al destino final
  totalTravelMinutes: number;    // Tiempo total estimado puerta a puerta
}

export interface TransitTransferSuggestion {
  id: string;
  firstLine: BusLine;
  firstStop: BusStop;
  transferStationName: string;
  transferStopFirst: BusStop;
  transferStopSecond: BusStop;
  secondLine: BusLine;
  destStop: BusStop;
  estimatedMinutes: number;
  walkTransferMeters?: number;
}

export interface Arrival {
  id: string;
  lineId: string;
  lineCode: string;
  destination: string;
  etaSeconds: number; // dynamically ticks down
  distanceMeters: number;
  busPlate: string;
  occupancy: 'low' | 'medium' | 'high';
  isAccessible: boolean;
  busLocation: [number, number];
  speedKmh: number;
  lineColor: string;
  lineTextColor: string;
  isAlertActive?: boolean;
}

export interface FavoriteItem {
  id: string; // unique key
  type: 'stop' | 'route';
  stopId?: string;
  stopName?: string;
  stopCode?: string;
  lineCode?: string;
  lineName?: string;
  lineColor?: string;
  destination?: string;
  savedAt: number;
}

export interface ActiveAlert {
  id: string; // e.g. "alert-line-stop-plate"
  stopId: string;
  stopName: string;
  lineCode: string;
  busPlate: string;
  thresholdMeters: number; // default 500m
  thresholdMinutes: number; // default 3 min
  createdTime: number;
  triggered: boolean;
  lastDistance?: number;
  lastEtaMinutes?: number;
}

export interface UserPosition {
  lat: number;
  lng: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
  isSimulated?: boolean;
}
