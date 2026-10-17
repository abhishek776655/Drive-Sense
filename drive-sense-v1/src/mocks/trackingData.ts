import {TRIP_ROAD_ROUTE_1, TRIP_ROAD_ROUTE_2} from './tripRoadRoutes';
import {reverseRoutePoints, type TimedRoutePoint} from '../utils/tripRoute';

export type RoutePoint = {
  latitude: number;
  longitude: number;
};

export type MockLocationPoint = {
  recorded_at: string;
  latitude: number;
  longitude: number;
  speed_mps: number;
  heading_deg: number;
  accuracy_m: number;
  altitude_m: number;
  is_moving: boolean;
  provider: string;
};

export type MockTripEvent = {
  event_type: 'harsh_brake' | 'rapid_acceleration' | 'overspeed';
  intensity: number;
  occurred_at: string;
  latitude: number;
  longitude: number;
  payload: {
    speed_mps?: number;
    speed_kph?: number;
    previous_speed_mps?: number;
    acceleration_mps2?: number;
    delta_seconds?: number;
    threshold_mps?: number;
    threshold_mps2?: number;
  };
};

export type MockTripInsight = {
  rule_id: string;
  category: string;
  tone: 'warning' | 'info' | 'success';
  title: string;
  message: string;
  metric_label: string;
  metric_value: string;
  priority: number;
};

export type MockTrip = {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  distance: string;
  duration: string;
  score: number;
  coordinates: RoutePoint[];
  routePoints: TimedRoutePoint[];
  startTime: string;
  endTime: string;
  category: string;
  status: string;
  /** Vehicle this trip was driven in. `vehicleId` is absent for mock/demo trips. */
  vehicleName?: string;
  vehicleId?: string;
  vehicleImageUrl?: string | null;
  avgSpeed: string;
  /** Recorded GPS top speed. Null when the backend has none for this trip. */
  maxSpeed: string | null;
  fuelConsumed: string;
  mileage: string;
  idleTime: string;
  stops: string;
  drivingScore: number;
  events: MockTripEvent[];
  insights?: MockTripInsight[];
};

export const MOCK_TRIPS: MockTrip[] = [
  {
    id: 'trip-001',
    title: 'Sector 62, Noida',
    subtitle: 'Connaught Place, Delhi',
    date: 'May 10, 2026 • 09:33 AM',
    distance: '24.1 km',
    duration: '1h 10m',
    score: 92,
    startTime: '09:15 AM',
    endTime: '10:25 AM',
    category: 'Business',
    status: 'Completed',
    avgSpeed: '34 km/h',
    maxSpeed: '82 km/h',
    fuelConsumed: '1.6 L',
    mileage: '15.0 km/l',
    idleTime: '6m',
    stops: '1',
    drivingScore: 92,
    coordinates: [
      {latitude: 28.62892, longitude: 77.36486},
      {latitude: 28.62794, longitude: 77.36092},
      {latitude: 28.62668, longitude: 77.35456},
      {latitude: 28.62496, longitude: 77.34661},
      {latitude: 28.62318, longitude: 77.33795},
      {latitude: 28.62147, longitude: 77.32982},
      {latitude: 28.61888, longitude: 77.31642},
      {latitude: 28.61742, longitude: 77.30081},
      {latitude: 28.62084, longitude: 77.27618},
      {latitude: 28.62796, longitude: 77.24264},
      {latitude: 28.63148, longitude: 77.21983},
    ],
    routePoints: TRIP_ROAD_ROUTE_1,
    events: [
      {
        event_type: 'overspeed',
        intensity: 1.12,
        occurred_at: '2026-05-10T09:37:50+05:30',
        latitude: 28.632194,
        longitude: 77.335687,
        payload: {
          threshold_mps: 27.78,
          speed_mps: 31.2,
          speed_kph: 112.3,
        },
      },
      {
        event_type: 'rapid_acceleration',
        intensity: 1.21,
        occurred_at: '2026-05-10T09:40:33+05:30',
        latitude: 28.624766,
        longitude: 77.308816,
        payload: {
          threshold_mps2: 3.0,
          acceleration_mps2: 3.63,
          speed_mps: 16.1,
          previous_speed_mps: 10.4,
          delta_seconds: 1.57,
        },
      },
      {
        event_type: 'harsh_brake',
        intensity: 1.08,
        occurred_at: '2026-05-10T09:51:20+05:30',
        latitude: 28.633781,
        longitude: 77.221833,
        payload: {
          threshold_mps2: -3.5,
          acceleration_mps2: -3.78,
          speed_mps: 6.8,
          previous_speed_mps: 11.2,
          delta_seconds: 1.16,
        },
      },
    ],
  },
  {
    id: 'trip-002',
    title: 'Akshardham, Delhi',
    subtitle: 'Sector 18, Noida',
    date: 'May 10, 2026 • 11:47 AM',
    distance: '18.7 km',
    duration: '41m',
    score: 88,
    startTime: '11:47 AM',
    endTime: '12:28 PM',
    category: 'Personal',
    status: 'Completed',
    avgSpeed: '31 km/h',
    maxSpeed: '74 km/h',
    fuelConsumed: '1.2 L',
    mileage: '15.6 km/l',
    idleTime: '4m',
    stops: '2',
    drivingScore: 88,
    coordinates: [
      {latitude: 28.61274, longitude: 77.27732},
      {latitude: 28.60861, longitude: 77.28492},
      {latitude: 28.60376, longitude: 77.29308},
      {latitude: 28.59892, longitude: 77.30118},
      {latitude: 28.59387, longitude: 77.30964},
      {latitude: 28.58841, longitude: 77.31824},
      {latitude: 28.58291, longitude: 77.32544},
      {latitude: 28.57594, longitude: 77.32563},
      {latitude: 28.57094, longitude: 77.32588},
      {latitude: 28.56724, longitude: 77.32637},
    ],
    routePoints: TRIP_ROAD_ROUTE_2,
    events: [
      {
        event_type: 'rapid_acceleration',
        intensity: 1.06,
        occurred_at: '2026-05-10T11:50:20+05:30',
        latitude: 28.618392,
        longitude: 77.279476,
        payload: {
          threshold_mps2: 3.0,
          acceleration_mps2: 3.19,
          speed_mps: 12.2,
          previous_speed_mps: 7.4,
          delta_seconds: 1.5,
        },
      },
      {
        event_type: 'overspeed',
        intensity: 1.03,
        occurred_at: '2026-05-10T11:57:34+05:30',
        latitude: 28.569471,
        longitude: 77.312055,
        payload: {
          threshold_mps: 27.78,
          speed_mps: 28.7,
          speed_kph: 103.3,
        },
      },
    ],
  },
  {
    id: 'trip-003',
    title: 'Connaught Place, Delhi',
    subtitle: 'Sector 62, Noida',
    date: 'May 10, 2026 • 07:10 PM',
    distance: '21.6 km',
    duration: '36m',
    score: 95,
    startTime: '07:10 PM',
    endTime: '07:46 PM',
    category: 'Business',
    status: 'Completed',
    avgSpeed: '37 km/h',
    maxSpeed: '86 km/h',
    fuelConsumed: '1.4 L',
    mileage: '15.4 km/l',
    idleTime: '3m',
    stops: '0',
    drivingScore: 95,
    coordinates: [
      {latitude: 28.63148, longitude: 77.21983},
      {latitude: 28.62874, longitude: 77.23621},
      {latitude: 28.62496, longitude: 77.25248},
      {latitude: 28.62094, longitude: 77.27591},
      {latitude: 28.61698, longitude: 77.29244},
      {latitude: 28.61827, longitude: 77.30768},
      {latitude: 28.62012, longitude: 77.32086},
      {latitude: 28.62174, longitude: 77.33154},
      {latitude: 28.62412, longitude: 77.34321},
      {latitude: 28.62644, longitude: 77.35447},
      {latitude: 28.62892, longitude: 77.36486},
    ],
    routePoints: reverseRoutePoints(TRIP_ROAD_ROUTE_1, '2026-05-10T19:10:00+05:30'),
    events: [
      {
        event_type: 'harsh_brake',
        intensity: 1.02,
        occurred_at: '2026-05-10T19:23:32+05:30',
        latitude: 28.620394,
        longitude: 77.285466,
        payload: {
          threshold_mps2: -3.5,
          acceleration_mps2: -3.57,
          speed_mps: 8.9,
          previous_speed_mps: 13.4,
          delta_seconds: 1.26,
        },
      },
    ],
  },
];

export const MOCK_LIVE_TRACKING = {
  trip_id: 'trip-live-001',
  state: 'active',
  start_time: '2026-05-10T09:33:00+05:30',
  vehicleName: 'Honda City',
  statusLabel: 'Tracking',
  location_points: [
    {
      recorded_at: '2026-05-10T09:33:08+05:30',
      latitude: 28.62892,
      longitude: 77.36486,
      speed_mps: 7.8,
      heading_deg: 248,
      accuracy_m: 6.2,
      altitude_m: 214.4,
      is_moving: true,
      provider: 'gps',
    },
    {
      recorded_at: '2026-05-10T09:33:40+05:30',
      latitude: 28.62867,
      longitude: 77.36348,
      speed_mps: 8.1,
      heading_deg: 248,
      accuracy_m: 6.1,
      altitude_m: 214.3,
      is_moving: true,
      provider: 'gps',
    },
    {
      recorded_at: '2026-05-10T09:34:12+05:30',
      latitude: 28.62831,
      longitude: 77.36174,
      speed_mps: 8.6,
      heading_deg: 247,
      accuracy_m: 5.9,
      altitude_m: 214.1,
      is_moving: true,
      provider: 'gps',
    },
    {
      recorded_at: '2026-05-10T09:34:38+05:30',
      latitude: 28.62796,
      longitude: 77.36003,
      speed_mps: 9.1,
      heading_deg: 247,
      accuracy_m: 5.8,
      altitude_m: 213.9,
      is_moving: true,
      provider: 'gps',
    },
    {
      recorded_at: '2026-05-10T09:35:06+05:30',
      latitude: 28.62754,
      longitude: 77.35829,
      speed_mps: 10.2,
      heading_deg: 246,
      accuracy_m: 5.5,
      altitude_m: 213.7,
      is_moving: true,
      provider: 'gps',
    },
    {
      recorded_at: '2026-05-10T09:35:40+05:30',
      latitude: 28.62712,
      longitude: 77.35641,
      speed_mps: 10.8,
      heading_deg: 246,
      accuracy_m: 5.3,
      altitude_m: 213.5,
      is_moving: true,
      provider: 'gps',
    },
    {
      recorded_at: '2026-05-10T09:36:14+05:30',
      latitude: 28.62666,
      longitude: 77.35448,
      speed_mps: 11.7,
      heading_deg: 245,
      accuracy_m: 5.1,
      altitude_m: 213.3,
      is_moving: true,
      provider: 'gps',
    },
    {
      recorded_at: '2026-05-10T09:36:46+05:30',
      latitude: 28.62625,
      longitude: 77.35257,
      speed_mps: 12.1,
      heading_deg: 245,
      accuracy_m: 5.0,
      altitude_m: 213.1,
      is_moving: true,
      provider: 'gps',
    },
    {
      recorded_at: '2026-05-10T09:37:18+05:30',
      latitude: 28.62583,
      longitude: 77.35061,
      speed_mps: 12.9,
      heading_deg: 245,
      accuracy_m: 5.0,
      altitude_m: 212.8,
      is_moving: true,
      provider: 'gps',
    },
    {
      recorded_at: '2026-05-10T09:37:49+05:30',
      latitude: 28.62539,
      longitude: 77.34859,
      speed_mps: 13.4,
      heading_deg: 245,
      accuracy_m: 5.0,
      altitude_m: 212.6,
      is_moving: true,
      provider: 'gps',
    },
    {
      recorded_at: '2026-05-10T09:38:22+05:30',
      latitude: 28.62491,
      longitude: 77.34642,
      speed_mps: 13.8,
      heading_deg: 244,
      accuracy_m: 5.2,
      altitude_m: 212.3,
      is_moving: true,
      provider: 'gps',
    },
    {
      recorded_at: '2026-05-10T09:38:56+05:30',
      latitude: 28.62445,
      longitude: 77.34428,
      speed_mps: 14.0,
      heading_deg: 244,
      accuracy_m: 5.3,
      altitude_m: 212.0,
      is_moving: true,
      provider: 'gps',
    },
    {
      recorded_at: '2026-05-10T09:39:29+05:30',
      latitude: 28.62396,
      longitude: 77.34214,
      speed_mps: 14.1,
      heading_deg: 243,
      accuracy_m: 5.4,
      altitude_m: 211.8,
      is_moving: true,
      provider: 'gps',
    },
    {
      recorded_at: '2026-05-10T09:40:02+05:30',
      latitude: 28.62351,
      longitude: 77.33997,
      speed_mps: 13.9,
      heading_deg: 243,
      accuracy_m: 5.5,
      altitude_m: 211.5,
      is_moving: true,
      provider: 'gps',
    },
    {
      recorded_at: '2026-05-10T09:40:34+05:30',
      latitude: 28.62308,
      longitude: 77.33779,
      speed_mps: 13.6,
      heading_deg: 242,
      accuracy_m: 5.7,
      altitude_m: 211.1,
      is_moving: true,
      provider: 'gps',
    },
    {
      recorded_at: '2026-05-10T09:41:08+05:30',
      latitude: 28.62262,
      longitude: 77.33571,
      speed_mps: 12.9,
      heading_deg: 242,
      accuracy_m: 5.8,
      altitude_m: 210.9,
      is_moving: true,
      provider: 'gps',
    },
    {
      recorded_at: '2026-05-10T09:41:40+05:30',
      latitude: 28.62215,
      longitude: 77.33358,
      speed_mps: 12.2,
      heading_deg: 241,
      accuracy_m: 5.9,
      altitude_m: 210.7,
      is_moving: true,
      provider: 'gps',
    },
    {
      recorded_at: '2026-05-10T09:42:14+05:30',
      latitude: 28.62168,
      longitude: 77.33146,
      speed_mps: 11.4,
      heading_deg: 241,
      accuracy_m: 6.0,
      altitude_m: 210.4,
      is_moving: true,
      provider: 'gps',
    },
    {
      recorded_at: '2026-05-10T09:42:46+05:30',
      latitude: 28.62124,
      longitude: 77.32941,
      speed_mps: 10.4,
      heading_deg: 240,
      accuracy_m: 6.1,
      altitude_m: 210.2,
      is_moving: true,
      provider: 'gps',
    },
  ],
};

export const MOCK_LIVE_STREAM = [
  {
    pointCount: 8,
    currentLocation: 'Sector 18 Link Road',
    events: 0,
    score: 91,
    fuelBurn: 0.8,
    harshBrake: 'No',
  },
  {
    pointCount: 12,
    currentLocation: 'Noida Link Road',
    events: 1,
    score: 89,
    fuelBurn: 0.9,
    harshBrake: '1 event',
  },
  {
    pointCount: 15,
    currentLocation: 'Film City corridor',
    events: 1,
    score: 90,
    fuelBurn: 1.0,
    harshBrake: 'Stable',
  },
  {
    pointCount: 18,
    currentLocation: 'Sector 16A corridor',
    events: 2,
    score: 88,
    fuelBurn: 1.1,
    harshBrake: '2 events',
  },
];

export const getMockTripById = (tripId: string) => MOCK_TRIPS.find((trip) => trip.id === tripId) ?? MOCK_TRIPS[0];
