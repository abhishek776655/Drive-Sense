import {tripUploadApi} from '../services/tripService';
import {toPointPayload, UPLOAD_BATCH} from '../services/tripUpload';
import {usePreferencesStore} from '../stores/preferencesStore';
import {useRecordingStore, type Sample} from '../stores/recordingStore';

/**
 * Uploads the live drive while it runs: starts the server trip, then sends queued fixes in batches.
 * One sync at a time. A batch is taken off the queue before it is sent and put back if the send
 * fails, so a batch can never be sent twice. If the drive ends while a batch is in flight and that
 * batch then fails, it is kept as an "orphan" for the trip and the finish step sends it.
 */
let inFlight: Promise<void> | null = null;
const orphans = new Map<string, Sample[]>();

export const takeOrphans = (tripId: string): Sample[] => {
  const samples = orphans.get(tripId) ?? [];
  orphans.delete(tripId);
  return samples;
};

/** Resolves once no sync is running, so ending a drive never races an upload. */
export const waitForSyncIdle = async (): Promise<void> => {
  while (inFlight) {
    await inFlight;
  }
};

async function runSync(): Promise<void> {
  const store = useRecordingStore.getState();
  if (store.status === 'ready' || !store.vehicle) {
    return;
  }
  if (usePreferencesStore.getState().driveBackup === 'phone') {
    // "This phone only": nothing goes up. Every fix is already kept in `drive_points`.
    store.takePending(store.pending.length);
    return;
  }
  let tripId = store.tripId;
  try {
    if (!tripId) {
      const trip = await tripUploadApi.start(store.vehicle.id, new Date(store.startedAt ?? Date.now()).toISOString());
      tripId = trip.id;
      // The drive may have ended while the start call was out; the finish step then starts its own.
      if (useRecordingStore.getState().startedAt === store.startedAt && useRecordingStore.getState().status !== 'ready') {
        useRecordingStore.getState().markTripStarted(tripId);
      } else {
        orphans.set(tripId, []);
        return;
      }
    }
    while (useRecordingStore.getState().tripId === tripId && useRecordingStore.getState().pending.length > 0) {
      useRecordingStore.getState().setSyncState('syncing');
      const batch = useRecordingStore.getState().takePending(UPLOAD_BATCH);
      try {
        await tripUploadApi.locations(tripId, batch.map(toPointPayload));
      } catch (error) {
        if (useRecordingStore.getState().tripId === tripId) {
          useRecordingStore.getState().returnPending(batch);
        } else {
          orphans.set(tripId, [...(orphans.get(tripId) ?? []), ...batch]);
        }
        throw error;
      }
    }
    if (useRecordingStore.getState().tripId === tripId) {
      useRecordingStore.getState().setSyncState('live');
    }
  } catch {
    if (useRecordingStore.getState().status !== 'ready') {
      useRecordingStore.getState().setSyncState('offline');
    }
  }
}

/** Runs one sync pass unless one is already running. Never throws. */
export const syncNow = (): Promise<void> => {
  if (!inFlight) {
    inFlight = runSync().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
};
