import * as Location from 'expo-location';
import {usePreferencesStore} from '../stores/preferencesStore';
import {POWER_MODES} from './powerMode';
import {useEffect} from 'react';
import {useRecordingStore} from '../stores/recordingStore';

/**
 * Foreground GPS into the recording store: Ready (speed, auto-start) and live drives in Expo Go.
 * On a dev or store build the background task takes over while a drive is live.
 */
export function useLocationFeed(active: boolean): void {
  const ingest = useRecordingStore((state) => state.ingest);
  const setPermission = useRecordingStore((state) => state.setPermission);

  useEffect(() => {
    if (!active) {
      return;
    }
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      const result = await Location.requestForegroundPermissionsAsync();
      if (cancelled) {
        return;
      }
      if (result.status !== 'granted') {
        setPermission('denied');
        return;
      }
      setPermission('granted');
      subscription = await Location.watchPositionAsync(
        (() => {
          // Power mode (Settings) trades GPS precision for battery; read when the watcher starts.
          const mode = POWER_MODES[usePreferencesStore.getState().powerMode];
          return {accuracy: Location.Accuracy[mode.accuracy], timeInterval: mode.timeInterval, distanceInterval: mode.distanceInterval};
        })(),
        (location) => {
          // While OS background updates run they deliver every fix, foreground included.
          const {backgroundActive, status} = useRecordingStore.getState();
          if (backgroundActive && status !== 'ready') {
            return;
          }
          ingest({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            speedMps: location.coords.speed != null && location.coords.speed >= 0 ? location.coords.speed : null,
            altitudeM: location.coords.altitude,
            headingDeg: location.coords.heading,
            accuracyM: location.coords.accuracy,
            timestamp: location.timestamp,
          });
        },
      );
      if (cancelled) {
        subscription.remove();
      }
    })();
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [active, ingest, setPermission]);
}
