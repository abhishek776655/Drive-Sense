import {useMemo} from 'react';
import {getDb} from '../db';
import {tripSensors} from '../db/sensorRepos';
import type {TripSensors} from '../tracking/sensors/types';

/** A drive's phone-sensor summary from this phone (corners, road, phone use); null when it has none. */
export function useTripSensors(startTime: string | null): TripSensors | null {
  return useMemo(() => {
    const db = getDb();
    if (!db || !startTime) {
      return null;
    }
    try {
      return tripSensors(db, Date.parse(startTime));
    } catch {
      return null;
    }
  }, [startTime]);
}
