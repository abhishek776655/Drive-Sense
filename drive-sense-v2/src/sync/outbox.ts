import {isAxiosError} from 'axios';
import {clearDrivePoints, deleteTrips, outboxList, outboxRemove, outboxSetProgress, type OutboxItem} from '../db/repos';
import type {SqlDb} from '../db/sql';
import {uploadDrive, type UploadProgress} from '../services/tripUpload';

/** No answer from the app server (offline, or a gateway saying it is down): try again later. */
export const isOfflineError = (error: unknown) => isAxiosError(error) && (error.response == null || [502, 503, 504].includes(error.response.status));

/** Uploaded: the outbox entry and the phone's stand-in Logbook row go; the server's row comes by sync. */
export const finishOutboxItem = (db: SqlDb, id: string) => {
  db.transaction(() => {
    outboxRemove(db, id);
    deleteTrips(db, [id]);
    // The drive's fixes were only kept to score it; the server has them now.
    const startedAt = Number(id.replace(/^local:/, ''));
    if (Number.isFinite(startedAt)) {
      clearDrivePoints(db, startedAt);
    }
  });
};

/**
 * Uploads one saved drive, resuming from its saved progress and saving progress after every step,
 * so an interrupted upload (app closed, signal lost) never starts a second server trip.
 */
export async function uploadOutboxItem(
  db: SqlDb,
  item: OutboxItem,
  onProgress?: (next: UploadProgress) => void,
  upload: typeof uploadDrive = uploadDrive,
): Promise<UploadProgress> {
  const done = await upload(
    item.drive,
    item.samples,
    item.progress,
    (next) => {
      outboxSetProgress(db, item.id, next);
      onProgress?.(next);
    },
    item.metrics,
  );
  finishOutboxItem(db, item.id);
  return done;
}

/**
 * Uploads every waiting drive, oldest first (local-first part 2a). `skip` leaves out the drive the
 * summary screen is still handling. Stops at the first failure; returns how many went up.
 */
export async function flushOutbox(db: SqlDb, skip: (id: string) => boolean = () => false, upload: typeof uploadDrive = uploadDrive): Promise<number> {
  let sent = 0;
  for (const item of outboxList(db)) {
    if (skip(item.id)) {
      continue;
    }
    try {
      await uploadOutboxItem(db, item, undefined, upload);
      sent += 1;
    } catch (error) {
      if (isOfflineError(error)) {
        return sent;
      }
      // A drive the server refuses (vehicle deleted, bad data) stays on the phone; the next one goes on.
      console.warn('Upload of a saved drive failed', error);
    }
  }
  return sent;
}
