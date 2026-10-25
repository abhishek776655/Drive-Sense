import {usePathname} from 'expo-router';
import {useEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';
import {useRecordingStore} from '../stores/recordingStore';
import {useSensorDriveStore} from '../stores/sensorDriveStore';
import {countsAsPhoneUse} from './sensors/phoneUse';

const TICK_MS = 1000;

/**
 * Phone use while driving (spec 2026-10-25, telemetry sources, section 3): a tick a second while the
 * app is in front (which on a phone means unlocked) during a recording, adding the time when the
 * screen isn't one you drive with. Timers stop in the background, which is right: that time was
 * never phone use.
 */
export function usePhoneUseFeed(): void {
  const pathname = usePathname();
  const recording = useRecordingStore((s) => s.status === 'recording');
  const [active, setActive] = useState(AppState.currentState === 'active');
  // The tick reads the latest route without restarting.
  const route = useRef(pathname);
  useEffect(() => {
    route.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!active || !recording) {
      return;
    }
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const speedMps = useRecordingStore.getState().stats.speedMps;
      if (countsAsPhoneUse({appActive: true, pathname: route.current, speedMps, recording: true})) {
        useSensorDriveStore.getState().addPhoneUse(last, now);
      }
      last = now;
    }, TICK_MS);
    return () => clearInterval(id);
  }, [active, recording]);
}
