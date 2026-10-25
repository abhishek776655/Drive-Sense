import {getDb} from '../db';
import {putTripSensors} from '../db/sensorRepos';
import {useRecordingStore} from '../stores/recordingStore';
import {useSensorDriveStore} from '../stores/sensorDriveStore';

/** How often the drive's sensor summary is written while it records, so a crash keeps most of it. */
const SNAPSHOT_MS = 30_000;

/**
 * Starts each drive's sensor summary from empty and snapshots it to the database while the drive
 * records (spec 2026-10-25, telemetry sources, section 3). The drive's end saves the final copy
 * (`finishedDriveStore`).
 */
export function startSensorRecorder(): () => void {
  const db = getDb();
  let lastWrite = 0;
  const stopRec = useRecordingStore.subscribe((next, prev) => {
    if (next.startedAt != null && next.startedAt !== prev.startedAt && next.status === 'recording') {
      useSensorDriveStore.getState().reset();
      lastWrite = Date.now();
      return;
    }
    if (!db || next.status !== 'recording' || next.startedAt == null || Date.now() - lastWrite < SNAPSHOT_MS) {
      return;
    }
    lastWrite = Date.now();
    const summary = useSensorDriveStore.getState().summary();
    if (summary) {
      try {
        putTripSensors(db, next.startedAt, summary);
      } catch (error) {
        console.warn('Could not snapshot the drive\'s sensor data', error);
      }
    }
  });
  return stopRec;
}
