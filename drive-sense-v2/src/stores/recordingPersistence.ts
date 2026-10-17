import AsyncStorage from '@react-native-async-storage/async-storage';
import {useFinishedDriveStore} from './finishedDriveStore';
import {useRecordingStore, type FinishedDrive, type RecordingState, type Sample} from './recordingStore';
import type {UploadProgress} from '../services/tripUpload';

const SESSION_KEY = 'drive_session_v1';
const FINISHED_KEY = 'finished_drive_v1';
/** Writes are batched: a drive records a fix a second and storage does not need every one. */
const SAVE_EVERY_MS = 5000;
/** A recording drive whose last fix is older than this was interrupted (app killed, no background). */
const INTERRUPTED_AFTER_MS = 60_000;

const SESSION_FIELDS = [
  'status',
  'startedAt',
  'pausedMs',
  'pausedAt',
  'stats',
  'route',
  'vehicle',
  'tripId',
  'pending',
  'lastMovementAt',
  'lastAltitudeRef',
  'position',
] as const;

type SessionSnapshot = Pick<RecordingState, (typeof SESSION_FIELDS)[number]>;

export const snapshotSession = (state: RecordingState): SessionSnapshot | null => {
  if (state.status === 'ready') {
    return null;
  }
  const snapshot = {} as Record<string, unknown>;
  for (const field of SESSION_FIELDS) {
    snapshot[field] = state[field];
  }
  return snapshot as SessionSnapshot;
};

/**
 * What to restore from a saved drive. A recording drive that has gone quiet (the app was killed and
 * nothing recorded in the background) comes back paused at its last fix, so the clock does not
 * count the time the app was dead; Resume carries on, End finishes it.
 */
export const restoreSession = (snapshot: SessionSnapshot, now: number): Partial<RecordingState> => {
  const lastActivity = snapshot.position?.timestamp ?? snapshot.startedAt ?? now;
  const interrupted = snapshot.status === 'recording' && now - lastActivity > INTERRUPTED_AFTER_MS;
  return {
    ...snapshot,
    status: interrupted ? 'paused' : snapshot.status,
    pausedAt: interrupted ? lastActivity : snapshot.pausedAt,
    stats: {...snapshot.stats, speedMps: 0, liveG: null},
    syncState: snapshot.vehicle ? 'syncing' : 'local',
    recentFixes: [],
  };
};

interface FinishedSnapshot {
  drive: FinishedDrive;
  samples: Sample[];
  progress: UploadProgress;
}

let hydrated: Promise<void> | null = null;

/** Loads any saved drive once. The background task awaits this before recording into the store. */
export const hydrateRecording = (): Promise<void> => {
  if (!hydrated) {
    hydrated = (async () => {
      try {
        const [session, finished] = await Promise.all([AsyncStorage.getItem(SESSION_KEY), AsyncStorage.getItem(FINISHED_KEY)]);
        if (session) {
          useRecordingStore.getState().restore(restoreSession(JSON.parse(session) as SessionSnapshot, Date.now()));
        }
        if (finished) {
          const saved = JSON.parse(finished) as FinishedSnapshot;
          useFinishedDriveStore.setState({
            ...saved,
            saveStatus: saved.drive.vehicle ? 'error' : 'local',
            error: saved.drive.vehicle ? 'This drive was not saved yet.' : null,
          });
        }
      } catch {
        // Unreadable storage must never block the app; the drive is simply not restored.
      }
      startPersisting();
    })();
  }
  return hydrated;
};

let persisting = false;

function startPersisting() {
  if (persisting) {
    return;
  }
  persisting = true;
  let lastWrite = 0;
  let lastStatus = useRecordingStore.getState().status;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const writeSession = () => {
    timer = null;
    lastWrite = Date.now();
    const snapshot = snapshotSession(useRecordingStore.getState());
    void (snapshot ? AsyncStorage.setItem(SESSION_KEY, JSON.stringify(snapshot)) : AsyncStorage.removeItem(SESSION_KEY));
  };

  useRecordingStore.subscribe((state) => {
    // Status changes (start, pause, end) are written at once; fixes are batched.
    if (state.status !== lastStatus) {
      lastStatus = state.status;
      if (timer) {
        clearTimeout(timer);
      }
      writeSession();
      return;
    }
    if (!timer && state.status !== 'ready') {
      timer = setTimeout(writeSession, Math.max(0, SAVE_EVERY_MS - (Date.now() - lastWrite)));
    }
  });

  useFinishedDriveStore.subscribe((state) => {
    const keep = state.drive && state.saveStatus !== 'saved';
    void (keep
      ? AsyncStorage.setItem(FINISHED_KEY, JSON.stringify({drive: state.drive, samples: state.samples, progress: state.progress}))
      : AsyncStorage.removeItem(FINISHED_KEY));
  });
}
