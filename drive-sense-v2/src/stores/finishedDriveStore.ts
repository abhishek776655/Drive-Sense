import {create} from 'zustand';
import {getApiErrorMessage} from '../services/apiClient';
import {tripDetailApi, tripUploadApi, type TripDetail} from '../services/tripService';
import {progressFor, uploadDrive, type UploadProgress} from '../services/tripUpload';
import {getDb} from '../db';
import {clearDrivePoints, drivePoints, getDetail, outboxId, outboxPut, putLocalTrip} from '../db/repos';
import {clearObdSamples, deleteTripObd, obdSamples} from '../db/obdRepos';
import {finalizeObd} from '../sync/obdRecorder';
import {HIGH_RPM} from '../obd/series';
import {useVehicleStore} from './vehicleStore';
import {isPhoneOnly, lookUpAddresses} from '../sync/driveBackup';
import {tripMetrics, type TripMetrics} from '../utils/tripMetrics';
import {finishOutboxItem, isOfflineError} from '../sync/outbox';
import {useSyncStore} from '../sync/syncStore';
import {takeOrphans, waitForSyncIdle} from '../tracking/tripSync';
import type {FinishedDrive, Sample} from './recordingStore';

/**
 * `saving`: finishing on the server. `saved`: the trip is stored. `queued`: kept on the phone and
 * uploading when the server can be reached. `local`: no vehicle, nothing to send.
 */
/** The save in progress, so Discard can wait for it and never miss a trip it was creating. */
let saving: Promise<boolean> | null = null;

type SaveStatus = 'saving' | 'saved' | 'queued' | 'error' | 'local' | 'discarding';

interface FinishedDriveState {
  drive: FinishedDrive | null;
  /** The phone's numbers for the whole drive (local-first part 2b); null without its fixes. */
  metrics: TripMetrics | null;
  samples: Sample[];
  progress: UploadProgress;
  saveStatus: SaveStatus;
  error: string | null;
  /** Server's view of the stored trip (score, events with locations); null until loaded. */
  detail: TripDetail | null;
  /** The detail request finished, successfully or not. */
  detailDone: boolean;
  /** Shows the summary and immediately finishes the drive on the server. */
  show: (drive: FinishedDrive) => void;
  /** Finishes (or retries finishing) the drive. True once it is stored. */
  save: () => Promise<boolean>;
  /** Deletes the trip server-side if one exists, then forgets the drive. True on success. */
  discard: () => Promise<boolean>;
  close: () => void;
}

/**
 * The drive shown on the summary screen. The trip is finished on the server as soon as the drive
 * ends (so auto-ended and backgrounded drives are kept too); Save just closes the summary, retrying
 * first if that failed. Discard deletes the trip.
 */
export const useFinishedDriveStore = create<FinishedDriveState>((set, get) => ({
  drive: null,
  metrics: null,
  samples: [],
  progress: {tripId: null, uploadedPoints: 0, ended: false},
  saveStatus: 'saving',
  error: null,
  detail: null,
  detailDone: false,
  show: (drive) => {
    const db = getDb();
    // Scored on the phone from every fix it kept (part 2b), with the server's own rules.
    const points = db ? drivePoints(db, drive.startedAt) : [];
    // The adapter's wheel speeds (if the drive had an adapter) vet GPS braking and acceleration
    // events; read before the OBD summary below clears them.
    const adapter = db
      ? obdSamples(db, drive.startedAt).flatMap(({ts, row}) => (row.speed != null ? [{t: ts, kmh: row.speed}] : []))
      : [];
    const metrics = points.length > 1 ? tripMetrics(points, adapter.length > 0 ? {adapter} : {}) : null;
    if (db) {
      // The drive's OBD-II seconds become its summary and chart series (telemetry); kept only with a
      // vehicle. Car data is extra: a failure here must never stop the drive itself being saved.
      try {
        if (drive.vehicle) {
          const fuel = useVehicleStore.getState().vehicles.find((v) => v.id === drive.vehicle?.id)?.fuel_type;
          finalizeObd(db, drive, fuel === 'diesel' ? HIGH_RPM.diesel : HIGH_RPM.petrol);
        } else {
          clearObdSamples(db, drive.startedAt);
        }
      } catch (error) {
        console.warn('Could not save the drive\'s OBD data', error);
      }
    }
    set({drive, metrics, samples: drive.unsentSamples, progress: progressFor(drive), saveStatus: drive.vehicle ? 'saving' : 'local', error: null, detail: null, detailDone: false});
    if (drive.vehicle && db && isPhoneOnly()) {
      // "This phone only" (part 3): stored here for good, nothing uploads. The phone looks up the
      // addresses itself.
      putLocalTrip(db, drive, metrics ?? undefined, points);
      clearDrivePoints(db, drive.startedAt);
      // The summary's score and events come from the phone's own copy of the trip.
      set({saveStatus: 'saved', detail: getDetail(db, outboxId(drive)), detailDone: true});
      useSyncStore.setState((s) => ({version: s.version + 1}));
      const route = points.length > 0 ? points : drive.route;
      void lookUpAddresses(db, outboxId(drive), route[0], route[route.length - 1]);
    } else if (drive.vehicle) {
      // Saved on the phone before anything else (part 2a): it is in the Logbook now, and survives
      // the app closing or no signal until it is uploaded.
      if (db) {
        outboxPut(db, {id: outboxId(drive), drive, samples: drive.unsentSamples, progress: progressFor(drive), metrics: metrics ?? undefined});
        putLocalTrip(db, drive, metrics ?? undefined, points);
        useSyncStore.setState((s) => ({version: s.version + 1}));
      }
      void get().save();
    } else if (db) {
      // Nothing to save without a vehicle: the kept fixes can go.
      clearDrivePoints(db, drive.startedAt);
    }
  },
  save: () => {
    if (!saving) {
      saving = runSave().finally(() => {
        saving = null;
      });
    }
    return saving;
  },
  discard: async () => {
    await saving?.catch(() => false);
    const tripId = get().progress.tripId;
    set({saveStatus: 'discarding', error: null});
    try {
      await waitForSyncIdle();
      if (tripId) {
        await tripUploadApi.remove(tripId);
      }
      const db = getDb();
      const drive = get().drive;
      if (db && drive) {
        deleteTripObd(db, drive.startedAt);
        finishOutboxItem(db, outboxId(drive));
        useSyncStore.setState((s) => ({version: s.version + 1}));
      }
      get().close();
      return true;
    } catch (error) {
      set({saveStatus: 'error', error: getApiErrorMessage(error, 'Could not discard this drive.')});
      return false;
    }
  },
  close: () => set({drive: null, metrics: null, samples: [], saveStatus: 'saving', error: null, detail: null}),
}));

async function runSave(): Promise<boolean> {
  const {drive, saveStatus} = useFinishedDriveStore.getState();
  const set = useFinishedDriveStore.setState;
  const get = useFinishedDriveStore.getState;
  if (!drive || saveStatus === 'local') {
    return false;
  }
  if (saveStatus === 'saved') {
    return true;
  }
  const db = getDb();
  const id = outboxId(drive);
  set({saveStatus: 'saving', error: null});
  try {
    // A batch the live sync had in flight at End may have failed: send it with the rest.
    await waitForSyncIdle();
    const tripId = get().progress.tripId;
    if (tripId) {
      const orphaned = takeOrphans(tripId);
      if (orphaned.length > 0) {
        set({samples: [...orphaned, ...get().samples]});
        if (db) {
          outboxPut(db, {id, drive, samples: get().samples, progress: get().progress, metrics: get().metrics ?? undefined});
        }
      }
    }
    await uploadDrive(
      drive,
      get().samples,
      get().progress,
      (next) => {
        set({progress: next});
        if (db) {
          outboxPut(db, {id, drive, samples: get().samples, progress: next, metrics: get().metrics ?? undefined});
        }
      },
      get().metrics ?? undefined,
    );
    if (db) {
      finishOutboxItem(db, id);
    }
    set({saveStatus: 'saved'});
    void loadDetail();
    return true;
  } catch (error) {
    // No signal: the drive is safe on the phone and uploads later, so Save can close the summary.
    if (db && isOfflineError(error)) {
      set({saveStatus: 'queued', error: null});
      return true;
    }
    set({saveStatus: 'error', error: getApiErrorMessage(error, 'Could not save this drive.')});
    return false;
  }
}

/** Score and events come from the server once the trip is stored. Best effort: the summary works without them. */
async function loadDetail(): Promise<void> {
  const tripId = useFinishedDriveStore.getState().progress.tripId;
  if (!tripId) {
    return;
  }
  try {
    const detail = await tripDetailApi.get(tripId);
    if (useFinishedDriveStore.getState().progress.tripId === tripId) {
      useFinishedDriveStore.setState({detail, detailDone: true});
    }
  } catch {
    // The summary falls back to the phone's own event count.
    useFinishedDriveStore.setState({detailDone: true});
  }
}

