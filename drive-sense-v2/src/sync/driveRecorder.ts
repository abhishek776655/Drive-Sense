import {getDb} from '../db';
import {appendDrivePoints, lastDrivePointAt} from '../db/repos';
import {useRecordingStore, type RecordingState} from '../stores/recordingStore';

/**
 * Keeps every fix of the drive in progress on the phone (local-first part 2b). The upload queue
 * (`pending`) is emptied as batches go to the server, so it cannot score the whole drive at the end;
 * this copy can. New fixes are the ones at the tail of `pending` newer than the last one kept.
 */
export function startDriveRecorder(): () => void {
  const db = getDb();
  if (!db) {
    return () => {};
  }
  let drive: number | null = null;
  let lastAt = 0;
  const keep = (state: RecordingState) => {
    if (state.status === 'ready' || state.startedAt == null) {
      drive = null;
      return;
    }
    if (drive !== state.startedAt) {
      // A new drive, or one restored after a relaunch: carry on after what is already kept.
      drive = state.startedAt;
      lastAt = lastDrivePointAt(db, drive) ?? 0;
    }
    const fresh = state.pending.filter((p) => p.timestamp > lastAt);
    if (fresh.length > 0) {
      appendDrivePoints(db, drive, fresh);
      lastAt = fresh[fresh.length - 1].timestamp;
    }
  };
  keep(useRecordingStore.getState());
  return useRecordingStore.subscribe((next, prev) => {
    if (next.pending !== prev.pending || next.status !== prev.status) {
      keep(next);
    }
  });
}
