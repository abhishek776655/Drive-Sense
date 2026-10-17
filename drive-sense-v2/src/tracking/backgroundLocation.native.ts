import Constants, {ExecutionEnvironment} from 'expo-constants';
import * as Location from 'expo-location';
import {usePreferencesStore} from '../stores/preferencesStore';
import {POWER_MODES} from './powerMode';
import * as TaskManager from 'expo-task-manager';
import {useEffect} from 'react';
import {hydrateRecording} from '../stores/recordingPersistence';
import {useRecordingStore} from '../stores/recordingStore';
import {syncNow} from './tripSync';

export const BACKGROUND_LOCATION_TASK = 'drivesense-v2-background-location';
/** Background wakes are short: upload at most this often from them. */
const BACKGROUND_SYNC_EVERY_MS = 15_000;

/**
 * Expo Go is a shared app without its own background-location entitlement, so the OS will not run
 * our task there. Background recording needs a development or store build; Expo Go keeps the
 * foreground watcher only.
 */
export const backgroundSupported = (): boolean => Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

let lastBackgroundSync = 0;

/**
 * Registered at import time, not in a component: the OS can relaunch the JS context just to deliver
 * updates, before anything mounts. It feeds the same store as the foreground watcher (which stands
 * down while this runs), so there is one stream of fixes and nothing is uploaded twice. Never
 * throws: on iOS repeated task failures make the system stop waking the app, losing the trip.
 */
if (backgroundSupported() && !TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask<{locations?: Location.LocationObject[]}>(BACKGROUND_LOCATION_TASK, async ({data, error}) => {
    if (error) {
      console.warn('[background-location] task error', error.message);
      return;
    }
    const locations = data?.locations ?? [];
    if (locations.length === 0) {
      return;
    }
    try {
      await hydrateRecording();
      // A background relaunch starts a fresh JS context: load Settings (auto-stop, speed alert) too.
      if (!usePreferencesStore.getState().hydrated) {
        await usePreferencesStore.getState().hydrate();
      }
      const store = useRecordingStore.getState();
      if (store.status === 'ready') {
        // The updates outlived the drive: stop burning battery.
        await stopBackgroundLocation();
        return;
      }
      for (const location of locations) {
        useRecordingStore.getState().ingest({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          speedMps: location.coords.speed != null && location.coords.speed >= 0 ? location.coords.speed : null,
          altitudeM: location.coords.altitude,
          headingDeg: location.coords.heading,
          accuracyM: location.coords.accuracy,
          timestamp: location.timestamp,
        });
      }
      if (Date.now() - lastBackgroundSync >= BACKGROUND_SYNC_EVERY_MS) {
        lastBackgroundSync = Date.now();
        await syncNow();
      }
    } catch (taskError) {
      console.warn('[background-location] failed to record fixes', taskError);
    }
  });
}

export async function startBackgroundLocation(): Promise<boolean> {
  if (!backgroundSupported()) {
    return false;
  }
  try {
    const foreground = await Location.getForegroundPermissionsAsync();
    if (foreground.status !== 'granted') {
      return false;
    }
    const background = await Location.requestBackgroundPermissionsAsync();
    if (background.status !== 'granted') {
      return false;
    }
    if (!(await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK))) {
      // Power mode (Settings): read as each drive starts its background updates.
      const mode = POWER_MODES[usePreferencesStore.getState().powerMode];
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy[mode.accuracy],
        timeInterval: mode.timeInterval,
        distanceInterval: Math.max(2, mode.distanceInterval),
        // iOS otherwise pauses updates when it decides you stopped, truncating a trip at a long light.
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.AutomotiveNavigation,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'DriveSense is recording your drive',
          notificationBody: 'Tap to return to the live drive.',
          notificationColor: '#FF6D00',
        },
      });
    }
    return true;
  } catch (error) {
    console.warn('[background-location] unavailable', error);
    return false;
  }
}

export async function stopBackgroundLocation(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch {
    // Already stopped or never started.
  }
  useRecordingStore.getState().setBackgroundActive(false);
}

/** Runs OS background updates for the length of a live drive (dev and store builds only). */
export function useBackgroundLocation(): void {
  const live = useRecordingStore((s) => s.status !== 'ready');
  const setBackgroundActive = useRecordingStore((s) => s.setBackgroundActive);

  useEffect(() => {
    let cancelled = false;
    if (live) {
      void startBackgroundLocation().then((active) => {
        if (!cancelled) {
          setBackgroundActive(active);
        }
      });
    } else {
      void stopBackgroundLocation();
    }
    return () => {
      cancelled = true;
    };
  }, [live, setBackgroundActive]);
}
