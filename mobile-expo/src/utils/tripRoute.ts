export type RoutePoint = {
  latitude: number;
  longitude: number;
};

export type TimedRoutePoint = RoutePoint & {
  recorded_at: string;
};

export type RouteSpeedBandKey = 'slow' | 'urban' | 'cruise' | 'fast';

export type RouteSpeedBand = {
  key: RouteSpeedBandKey;
  label: string;
  range: string;
  color: string;
  min: number;
  max: number;
};

export type RouteBandStat = RouteSpeedBand & {
  durationSeconds: number;
  distanceMeters: number;
};

export type RouteSpeedSegment = {
  coordinates: [RoutePoint, RoutePoint];
  speedKph: number;
  durationSeconds: number;
  distanceMeters: number;
  band: RouteSpeedBand;
};

export type RouteColorSection = {
  coordinates: RoutePoint[];
  speedKph: number;
  durationSeconds: number;
  distanceMeters: number;
  band: RouteSpeedBand;
};

export type RouteSummary = {
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  averageSpeedKph: number;
  peakSpeedKph: number;
  stoppedDurationSeconds: number;
  movingDurationSeconds: number;
  sampleCount: number;
  bandStats: RouteBandStat[];
};

export const ROUTE_SPEED_BANDS: RouteSpeedBand[] = [
  {key: 'slow', label: 'Slow', range: '0-20 km/h', color: '#C05C55', min: 0, max: 20},
  {key: 'urban', label: 'Urban', range: '20-40 km/h', color: '#C3924F', min: 20, max: 40},
  {key: 'cruise', label: 'Cruise', range: '40-60 km/h', color: '#4E9B74', min: 40, max: 60},
  {key: 'fast', label: 'Fast', range: '60+ km/h', color: '#3F6FC4', min: 60, max: Number.POSITIVE_INFINITY},
];

const EARTH_RADIUS_METERS = 6371000;
const IST_OFFSET_MINUTES = 330;

const toRadians = (value: number) => (value * Math.PI) / 180;

export const haversineMeters = (start: RoutePoint, end: RoutePoint) => {
  const deltaLat = toRadians(end.latitude - start.latitude);
  const deltaLng = toRadians(end.longitude - start.longitude);
  const startLat = toRadians(start.latitude);
  const endLat = toRadians(end.latitude);

  const arc =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
};

const toDateMs = (value: string) => new Date(value).getTime();

const getBandForSpeed = (speedKph: number) =>
  ROUTE_SPEED_BANDS.find((band) => speedKph >= band.min && speedKph < band.max) ?? ROUTE_SPEED_BANDS[0];

export const buildRouteSpeedSegments = (points: TimedRoutePoint[]): RouteSpeedSegment[] => {
  const segments: RouteSpeedSegment[] = [];

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const durationSeconds = Math.max(1, (toDateMs(end.recorded_at) - toDateMs(start.recorded_at)) / 1000);
    const distanceMeters = haversineMeters(start, end);
    const speedKph = (distanceMeters / durationSeconds) * 3.6;
    const band = getBandForSpeed(speedKph);

    segments.push({
      coordinates: [start, end],
      speedKph,
      durationSeconds,
      distanceMeters,
      band,
    });
  }

  return segments;
};

export const buildRouteColorSections = (points: TimedRoutePoint[]): RouteColorSection[] => {
  const segments = buildRouteSpeedSegments(points);
  if (segments.length === 0) {
    return [];
  }

  const sections: RouteColorSection[] = [];
  let current: RouteColorSection | null = null;

  segments.forEach((segment) => {
    if (!current || current.band.key !== segment.band.key) {
      current = {
        coordinates: [segment.coordinates[0], segment.coordinates[1]],
        speedKph: segment.speedKph,
        durationSeconds: segment.durationSeconds,
        distanceMeters: segment.distanceMeters,
        band: segment.band,
      };
      sections.push(current);
      return;
    }

    current.coordinates.push(segment.coordinates[1]);
    current.durationSeconds += segment.durationSeconds;
    current.distanceMeters += segment.distanceMeters;
    current.speedKph = (current.distanceMeters / current.durationSeconds) * 3.6;
  });

  return sections;
};

export const getRouteSummary = (points: TimedRoutePoint[]): RouteSummary => {
  const segments = buildRouteSpeedSegments(points);
  const totalDistanceMeters = segments.reduce((sum, segment) => sum + segment.distanceMeters, 0);
  const totalDurationSeconds = segments.reduce((sum, segment) => sum + segment.durationSeconds, 0);
  const movingDurationSeconds = segments
    .filter((segment) => segment.speedKph >= 5)
    .reduce((sum, segment) => sum + segment.durationSeconds, 0);
  const bandStats = ROUTE_SPEED_BANDS.map((band) => ({
    ...band,
    durationSeconds: segments
      .filter((segment) => segment.band.key === band.key)
      .reduce((sum, segment) => sum + segment.durationSeconds, 0),
    distanceMeters: segments
      .filter((segment) => segment.band.key === band.key)
      .reduce((sum, segment) => sum + segment.distanceMeters, 0),
  }));

  return {
    totalDistanceMeters,
    totalDurationSeconds,
    averageSpeedKph: totalDurationSeconds > 0 ? (totalDistanceMeters / totalDurationSeconds) * 3.6 : 0,
    peakSpeedKph: segments.reduce((max, segment) => Math.max(max, segment.speedKph), 0),
    stoppedDurationSeconds: Math.max(0, totalDurationSeconds - movingDurationSeconds),
    movingDurationSeconds,
    sampleCount: points.length,
    bandStats,
  };
};

export const getRouteRegion = (coordinates: RoutePoint[]) => {
  const latitudes = coordinates.map((point) => point.latitude);
  const longitudes = coordinates.map((point) => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.02, (maxLat - minLat) * 1.5),
    longitudeDelta: Math.max(0.02, (maxLng - minLng) * 1.5),
  };
};

export const formatDurationShort = (totalSeconds: number) => {
  const roundedMinutes = Math.max(1, Math.round(totalSeconds / 60));
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return `${roundedMinutes}m`;
};

export const formatDistanceLabel = (distanceMeters: number) => `${(distanceMeters / 1000).toFixed(1)} km`;

export const formatSpeedLabel = (speedKph: number) => `${Math.round(speedKph)} km/h`;

export const formatOffsetIso = (dateMs: number, offsetMinutes = IST_OFFSET_MINUTES) => {
  const shifted = new Date(dateMs + offsetMinutes * 60 * 1000);
  return `${shifted.toISOString().replace('Z', '')}${offsetMinutes >= 0 ? '+' : '-'}${String(
    Math.floor(Math.abs(offsetMinutes) / 60),
  ).padStart(2, '0')}:${String(Math.abs(offsetMinutes) % 60).padStart(2, '0')}`;
};

export const retimeRoutePoints = (points: TimedRoutePoint[], nextStartTime: string) => {
  if (points.length === 0) {
    return [];
  }

  const startMs = toDateMs(nextStartTime);
  const output: TimedRoutePoint[] = [{...points[0], recorded_at: nextStartTime}];
  let currentMs = startMs;

  for (let index = 1; index < points.length; index += 1) {
    const deltaMs = Math.max(1000, toDateMs(points[index].recorded_at) - toDateMs(points[index - 1].recorded_at));
    currentMs += deltaMs;
    output.push({
      ...points[index],
      recorded_at: formatOffsetIso(currentMs),
    });
  }

  return output;
};

export const reverseRoutePoints = (points: TimedRoutePoint[], nextStartTime: string) => {
  const reversed = [...points].reverse();
  if (reversed.length === 0) {
    return [];
  }

  const startMs = toDateMs(nextStartTime);
  const output: TimedRoutePoint[] = [{...reversed[0], recorded_at: nextStartTime}];
  let currentMs = startMs;

  for (let index = 1; index < reversed.length; index += 1) {
    const deltaMs = Math.max(
      1000,
      Math.abs(toDateMs(reversed[index - 1].recorded_at) - toDateMs(reversed[index].recorded_at)),
    );
    currentMs += deltaMs;
    output.push({
      ...reversed[index],
      recorded_at: formatOffsetIso(currentMs),
    });
  }

  return output;
};

export const createTimedRouteFallback = (coordinates: RoutePoint[], startTime: string) => {
  const startMs = toDateMs(startTime);

  return coordinates.map((point, index) => ({
    ...point,
    recorded_at: formatOffsetIso(startMs + index * 90 * 1000),
  }));
};
