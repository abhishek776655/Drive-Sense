import * as Location from 'expo-location';
import {useEffect, useState} from 'react';
import {Platform} from 'react-native';

/** Compass readings closer than this to the last one are not worth a re-render. */
const COMPASS_STEP_DEG = 1;

/**
 * The phone's own compass (true north, else magnetic) while `on`: it points the right way standing
 * still, which GPS course cannot. Null without a magnetometer (the simulator) or permission.
 */
export function useCompass(on: boolean): number | null {
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
