import {Barometer} from 'expo-sensors';
import {useEffect} from 'react';
import {useRecordingStore} from '../stores/recordingStore';

/** One pressure reading a second is plenty: GPS fixes come about as often. */
const SAMPLE_MS = 1000;

/**
 * Air pressure into the recording store while `active` (spec 2026-10-25, telemetry sources,
 * section 3). Phones without a barometer (and the Simulator) simply never report.
 */
export function useBarometerFeed(active: boolean): void {
  const ingestPressure = useRecordingStore((s) => s.ingestPressure);
  useEffect(() => {
    if (!active) {
      return;
    }
    let sub: {remove: () => void} | null = null;
    let cancelled = false;
    Barometer.isAvailableAsync()
      .then((ok) => {
        if (!ok || cancelled) {
          return;
        }
        Barometer.setUpdateInterval(SAMPLE_MS);
        sub = Barometer.addListener(({pressure}) => ingestPressure(pressure, Date.now()));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [active, ingestPressure]);
}
