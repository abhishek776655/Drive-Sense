import * as Location from 'expo-location';
import {useEffect, useRef, useState} from 'react';
import {Platform} from 'react-native';
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

/** Compass readings closer than this to the last one are not worth a re-render. */
const COMPASS_STEP_DEG = 1;

/**
 * The phone's own compass (true north, else magnetic) while `on`: it points the right way standing
 * still, which GPS course cannot. Null without a magnetometer (the simulator) or permission.
 */
function useCompass(on: boolean): number | null {
  const [deg, setDeg] = useState<number | null>(null);
  useEffect(() => {
    if (!on || Platform.OS === 'web') {
      return;
    }
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    let last = -999;
    Location.watchHeadingAsync((h) => {
      const next = h.trueHeading >= 0 ? h.trueHeading : h.magHeading >= 0 ? h.magHeading : null;
      if (next == null) {
        return;
      }
      const moved = Math.abs(((next - last + 540) % 360) - 180);
      if (moved >= COMPASS_STEP_DEG) {
        last = next;
        setDeg(next);
      }
    })
      .then((s) => {
        if (cancelled) {
          s.remove();
        } else {
          sub = s;
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [on]);
  return on ? deg : null;
}

/**
 * What the phone alone can say about the drive, for the cluster's phone dials: recent GPS speed,
 * altitude and the road's gradient, and the heading. Follows every fix, drive or not. With
 * `compass` on, the heading comes from the phone's compass first, then the direction of travel
 * (held while stopped), then the last fix's course.
 */
export function usePhoneTrace(compass = false): PhoneTrace {
  const position = useRecordingStore((s) => s.position);
  const heldHeading = useRecordingStore((s) => s.stats.headingDeg);
  const compassDeg = useCompass(compass);
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
    // The barometer-refined altitude when the phone has one, else GPS (the store picks), as of this fix.
    const alt = useRecordingStore.getState().stats.altitudeM ?? position.altitudeM;
    if (alt != null) {
      climb.current = [...climb.current.filter((p) => p.d >= d - GRADE_WINDOW_M * 2), {d, alt}];
    }
    const at = position.timestamp;
    const kmh = position.speedMps != null && position.speedMps >= 0 ? position.speedMps * 3.6 : null;
    const grade = gradePct(climb.current);
    // Set after the effect, as React prefers, with the reading this fix brought.
    const id = setTimeout(
      () =>
        setTrace((t) => ({
          speed: kmh == null ? t.speed : [...t.speed.filter((p) => at - p.at <= SPEED_TRACE_MS), {at, kmh}],
          altitudeM: alt ?? t.altitudeM,
          gradePct: grade,
          headingDeg: position.headingDeg != null && position.headingDeg >= 0 ? position.headingDeg : t.headingDeg,
        })),
      0,
    );
    return () => clearTimeout(id);
  }, [position]);

  return {...trace, headingDeg: compassDeg ?? heldHeading ?? trace.headingDeg};
}
