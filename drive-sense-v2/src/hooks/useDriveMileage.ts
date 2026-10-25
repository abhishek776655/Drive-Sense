import {useEffect, useState} from 'react';
import {getDb} from '../db';
import {obdSamples} from '../db/obdRepos';
import {summarize} from '../obd/series';
import {useRecordingStore} from '../stores/recordingStore';

/** The drive's seconds are written in small batches, so re-reading more often than this adds nothing. */
const REFRESH_MS = 5000;

export interface DriveFuel {
  /** Mileage so far as L/100 km; null when too short to say. */
  l100km: number | null;
  fuelUsedL: number | null;
}

/**
 * The recording drive's mileage and fuel so far, worked out the same way as its summary at the
 * end: fuel and distance from its 1 Hz adapter rows. Null when not recording.
 */
export function useDriveFuel(): DriveFuel | null {
  const startedAt = useRecordingStore((s) => (s.status === 'recording' ? s.startedAt : null));
  const [fuel, setFuel] = useState<DriveFuel | null>(null);
  useEffect(() => {
    if (startedAt == null) {
      return;
    }
    const read = () => {
      const db = getDb();
      if (!db) {
        return;
      }
      try {
        const stats = summarize(obdSamples(db, startedAt), 1);
        setFuel({l100km: stats.avgL100km, fuelUsedL: stats.fuelUsedL});
      } catch {
        setFuel(null);
      }
    };
    const first = setTimeout(read, 0);
    const id = setInterval(read, REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [startedAt]);
  // Not recording: nothing to show, whatever the last drive left behind.
  return startedAt == null ? null : fuel;
}

/** Just this drive's mileage so far (L/100 km). */
export const useDriveMileage = (): number | null => useDriveFuel()?.l100km ?? null;
