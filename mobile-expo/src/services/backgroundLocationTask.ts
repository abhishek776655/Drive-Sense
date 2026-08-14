import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import {tripService} from './tripService';

export const BACKGROUND_LOCATION_TASK = 'drivesense-background-location';

/**
 * The trip the background task should attribute points to.
 *
 * The task is registered at module scope and runs in a JS context with no React state, so the
 * active trip has to be handed over through storage rather than through props or a store.
 */
const ACTIVE_TRIP_KEY = 'active_background_trip_id';

export const setBackgroundTripId = (tripId: string) => AsyncStorage.setItem(ACTIVE_TRIP_KEY, tripId);
export const clearBackgroundTripId = () => AsyncStorage.removeItem(ACTIVE_TRIP_KEY);
export const getBackgroundTripId = () => AsyncStorage.getItem(ACTIVE_TRIP_KEY);

/** Maps an OS location sample to the ingest payload the API expects. */
export const toLocationPayload = (location: Location.LocationObject) => ({
  recorded_at: new Date(location.timestamp).toISOString(),
  latitude: location.coords.latitude,
  longitude: location.coords.longitude,
  speed_mps: location.coords.speed != null && location.coords.speed >= 0 ? location.coords.speed : 0,
  heading_deg:
    location.coords.heading != null && location.coords.heading >= 0 ? location.coords.heading : null,
  accuracy_m: Math.max(0, location.coords.accuracy ?? 0),
  altitude_m: location.coords.altitude ?? null,
  is_moving: (location.coords.speed ?? 0) > 0.5,
  provider: 'background',
});

/**
 * Registered at import time, not inside a component: the OS relaunches this JS context on its own
 * to deliver updates, at which point no component has mounted yet.
 *
 * Deliberately never throws. A rejected background task is killed by the OS and, on iOS, repeated
 * failures make the system stop waking the app at all — losing the rest of the trip.
 */
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({data, error}) => {
  if (error) {
    console.warn('[background-location] task error', error.message);
    return;
  }

  const locations = (data as {locations?: Location.LocationObject[]} | undefined)?.locations;
  if (!locations || locations.length === 0) {
    return;
  }

  try {
    const tripId = await getBackgroundTripId();
    if (!tripId) {
      // No trip in progress — the updates outlived the trip, so stop burning battery.
      await stopBackgroundLocationUpdates();
      return;
    }

    // Event detection stays off here to match the foreground path, which scores events itself from
    // the full point series rather than from whatever subset a single background wake delivered.
    await tripService.sendLocations(tripId, locations.map(toLocationPayload), false);
  } catch (taskError) {
    console.warn('[background-location] failed to sync points', taskError);
  }
});

/** True once the OS is delivering background updates to our task. */
export const isBackgroundLocationActive = () =>
  Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);

export const startBackgroundLocationUpdates = async (tripId: string) => {
  await setBackgroundTripId(tripId);

  if (await isBackgroundLocationActive()) {
    return;
  }

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    // Matches the foreground watcher so a trip's point density does not change when the app is
    // backgrounded and the route does not visibly coarsen.
    timeInterval: 3000,
    distanceInterval: 5,
    // iOS pauses updates when it decides you have stopped moving, which silently truncates a trip
    // that is only waiting at a long light.
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'DriveSense is recording your trip',
      notificationBody: 'Tap to return to the live trip.',
      notificationColor: '#246BFF',
    },
  });
};

export const stopBackgroundLocationUpdates = async () => {
  await clearBackgroundTripId();
  if (await isBackgroundLocationActive()) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
};
