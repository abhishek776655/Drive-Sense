import {useEffect, useRef, useState} from 'react';
import {useRecordingStore} from '../stores/recordingStore';
import {haversineMeters} from '../utils/geo';
import {gradePct, GRADE_WINDOW_M} from './motion';

/** The speed graph covers this much time. */
export const SPEED_TRACE_MS = 120_000;

export interface PhoneTrace {
  /** GPS speed over the last two minutes, km/h. */
  speed: {at: number; kmh: number}[];
  altitudeM: number | null;
  gradePct: number | null;
  headingDeg: number | null;
}

/**
 * What the phone alone can say about the drive, for the cluster's phone dials: recent GPS speed,
 * altitude and the road's gradient, and the heading. Follows every fix, drive or not.
 */
export function usePhoneTrace(): PhoneTrace {
  const position = useRecordingStore((s) => s.position);
  const climb = useRef<{d: number; alt: number}[]>([]);
  const last = useRef<{latitude: number; longitude: number; d: number} | null>(null);
  const [trace, setTrace] = useState<PhoneTrace>({speed: [], altitudeM: null, gradePct: null, headingDeg: null});

  useEffect(() => {
    if (!position) {
      return;
    }
    const prev = last.current;
    const d = prev ? prev.d + haversineMeters(prev, position) : 0;
    last.current = {latitude: position.latitude, longitude: position.longitude, d};
    if (position.altitudeM != null) {
      climb.current = [...climb.current.filter((p) => p.d >= d - GRADE_WINDOW_M * 2), {d, alt: position.altitudeM}];
    }
    const at = position.timestamp;
    const kmh = position.speedMps != null && position.speedMps >= 0 ? position.speedMps * 3.6 : null;
    const grade = gradePct(climb.current);
    // Set after the effect, as React prefers, with the reading this fix brought.
    const id = setTimeout(
      () =>
        setTrace((t) => ({
          speed: kmh == null ? t.speed : [...t.speed.filter((p) => at - p.at <= SPEED_TRACE_MS), {at, kmh}],
          altitudeM: position.altitudeM ?? t.altitudeM,
          gradePct: grade,
          headingDeg: position.headingDeg != null && position.headingDeg >= 0 ? position.headingDeg : t.headingDeg,
        })),
      0,
    );
    return () => clearTimeout(id);
  }, [position]);

  return trace;
}
