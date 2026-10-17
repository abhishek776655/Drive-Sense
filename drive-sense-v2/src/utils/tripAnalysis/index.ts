import type {TripPoint} from '../../services/tripService';
import {bucketMinutesFor, distanceByTime, type DistanceBucket} from './distanceByTime';
import {elevationProfile, type ElevationProfile} from './elevation';
import {gForceSeries, type GSample} from './gforce';
import {cleanPoints, segments, type CleanPoint, type Segment} from './prepare';
import {gpsQuality, sensorGSeries, smoothnessScore} from './quality';
import {MAP_POINTS, speedSeries, type SpeedSample} from './series';
import {detectStops, type Stop} from './stops';
import {thin} from './thin';
import {timeAtSpeed, tripTimes, type SpeedBand, type TripTimes} from './times';

export * from './distanceByTime';
export * from './elevation';
export * from './gforce';
export * from './prepare';
export * from './quality';
export * from './replay';
export * from './series';
export * from './stops';
export * from './thin';
export * from './times';

export interface TripAnalysis {
  points: CleanPoint[];
  route: {latitude: number; longitude: number}[];
  times: TripTimes;
  bands: SpeedBand[];
  elevation: ElevationProfile | null;
  stops: Stop[];
  speed: {samples: SpeedSample[]; peak: SpeedSample | null};
  gforce: {samples: GSample[]; peakAccel: GSample | null; peakBrake: GSample | null};
  distance: {bucketMinutes: number; buckets: DistanceBucket[]};
  smoothness: number | null;
  gps: ReturnType<typeof gpsQuality>;
  sensorG: {t: number; g: number}[];
  /** For time-over-limit, worked out per limit by the page. */
  segments: Segment[];
}

/** Everything the trip page derives from the GPS points, computed once per trip. */
export const analyseTrip = (raw: TripPoint[]): TripAnalysis => {
  const points = cleanPoints(raw);
  const segs = segments(points);
  const durationS = points.length > 1 ? (points[points.length - 1].t - points[0].t) / 1000 : 0;
  const bucketMinutes = bucketMinutesFor(durationS);
  return {
    points,
    route: thin(points, MAP_POINTS).map((p) => ({latitude: p.latitude, longitude: p.longitude})),
    times: tripTimes(segs),
    bands: timeAtSpeed(segs),
    elevation: elevationProfile(points),
    stops: detectStops(segs),
    speed: speedSeries(points),
    gforce: gForceSeries(points),
    distance: {bucketMinutes, buckets: distanceByTime(segs, bucketMinutes)},
    smoothness: smoothnessScore(points),
    gps: gpsQuality(raw),
    sensorG: sensorGSeries(raw),
    segments: segs,
  };
};
