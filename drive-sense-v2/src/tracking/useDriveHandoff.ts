import {router} from 'expo-router';
import {useEffect} from 'react';
import {Alert} from 'react-native';
import {usePreferencesStore} from '../stores/preferencesStore';
import {isShortDrive} from '../utils/autoTrip';
import {useFinishedDriveStore} from '../stores/finishedDriveStore';
import {useRecordingStore} from '../stores/recordingStore';
import {useActiveVehicle, useVehicleStore} from '../stores/vehicleStore';

/**
 * Glue between the recording session and the rest of the app:
 * - a drive that ends (End button or the 3-minute parked rule, even while backgrounded) opens its
 *   summary, which finishes it on the server; with "Ignore short drives" on, a drive under 300 m or
 *   a minute is discarded instead (its server trip deleted) and no summary opens;
 * - a summary left unsaved by a crash reopens on launch;
 * - auto-start uses the vehicle picked on Drive.
 */
export function useDriveHandoff(): void {
  const justFinished = useRecordingStore((s) => s.justFinished);
  const consumeFinished = useRecordingStore((s) => s.consumeFinished);
  const setDefaultVehicle = useRecordingStore((s) => s.setDefaultVehicle);
  const showSummary = useFinishedDriveStore((s) => s.show);
  const loadVehicles = useVehicleStore((s) => s.load);
  const vehicle = useActiveVehicle();

  useEffect(() => {
    void loadVehicles();
  }, [loadVehicles]);

  useEffect(() => {
    setDefaultVehicle(vehicle ? {id: vehicle.id, name: vehicle.display_name} : null);
  }, [vehicle, setDefaultVehicle]);

  useEffect(() => {
    if (!justFinished) {
      return;
    }
    const finished = consumeFinished();
    if (!finished) {
      return;
    }
    showSummary(finished);
    if (usePreferencesStore.getState().ignoreShortDrives && isShortDrive(finished.distanceM, finished.durationSeconds)) {
      void useFinishedDriveStore.getState().discard();
      Alert.alert('Short drive not saved', 'Drives under 300 m or a minute are ignored. You can change this in Settings.');
      return;
    }
    router.push('/trip-summary');
  }, [justFinished, consumeFinished, showSummary]);

  useEffect(() => {
    if (useFinishedDriveStore.getState().drive) {
      router.push('/trip-summary');
    }
  }, []);
}
