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
