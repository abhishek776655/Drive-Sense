import * as Network from 'expo-network';
import {AppState} from 'react-native';
import {getDb, wipeDb} from '../db';
import {useAuthStore} from '../stores/authStore';
import {useFinishedDriveStore} from '../stores/finishedDriveStore';
import {useRecordingStore} from '../stores/recordingStore';
import {outboxId} from '../db/repos';
import {backfillRoutes} from './backfill';
import {isPhoneOnly} from './driveBackup';
import {flushOutbox} from './outbox';
import {hasSynced, pullAll} from './pull';
import {useSyncStore} from './syncStore';

/** Coming back to the app pulls at most this often. */
export const FOREGROUND_PULL_MS = 60 * 1000;

let running: Promise<void> | null = null;
let backfilling = false;
let lastPullAt = 0;

const onWifi = async () => {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.type === Network.NetworkStateType.WIFI || state.type === Network.NetworkStateType.ETHERNET;
  } catch {
    return false;
  }
};

const signedIn = () => useAuthStore.getState().status === 'signedIn';

/** Routes download quietly in the background: Wi-Fi only, never during a drive. */
const backfill = async () => {
  const db = getDb();
  if (!db || backfilling) {
    return;
  }
  backfilling = true;
  try {
    const saved = await backfillRoutes(db, async () => signedIn() && useRecordingStore.getState().status === 'ready' && (await onWifi()));
    if (saved > 0) {
      useSyncStore.setState((s) => ({version: s.version + 1}));
    }
  } finally {
    backfilling = false;
  }
};

/** Pulls changes into the local database (one at a time), then tops up missing routes. */
export const requestSync = (): Promise<void> => {
  const db = getDb();
  if (!db || !signedIn()) {
    return Promise.resolve();
  }
  if (running) {
    return running;
  }
  if (isPhoneOnly()) {
    // "This phone only" (part 3): drives neither go up nor come down; the phone's copy is the one.
    useSyncStore.setState({ready: true});
    return Promise.resolve();
  }
  useSyncStore.setState({syncing: true});
  running = (async () => {
    try {
      // Drives saved on the phone go up first, so the pull brings back the server's versions.
      const shown = useFinishedDriveStore.getState();
      const busyId = shown.drive && shown.saveStatus === 'saving' ? outboxId(shown.drive) : null;
      const sent = await flushOutbox(db, (id) => id === busyId);
      if (sent > 0) {
        useSyncStore.setState((s) => ({version: s.version + 1}));
      }
      const changed = await pullAll(db);
      lastPullAt = Date.now();
      useSyncStore.setState((s) => ({ready: true, lastError: null, version: changed > 0 ? s.version + 1 : s.version}));
    } catch (error) {
      // Offline: whatever is on the phone stays on screen.
      useSyncStore.setState({lastError: error instanceof Error ? error.message : 'Sync failed'});
    } finally {
      useSyncStore.setState({syncing: false});
      running = null;
    }
    void backfill();
  })();
  return running;
};

/**
 * Keeps the local copy current (spec 2026-10-17, local-first parts 1 and 2a): on start, coming back
 * to the app (at most once a minute), after a drive is stored and when the network returns, first
 * uploading drives saved on the phone. Returns the unsubscribe function.
 */
export function startSync(): () => void {
  const db = getDb();
  if (!db) {
    return () => {};
  }
  useSyncStore.setState({ready: hasSynced(db) || isPhoneOnly()});
  void requestSync();
  const app = AppState.addEventListener('change', (next) => {
    if (next === 'active' && Date.now() - lastPullAt >= FOREGROUND_PULL_MS) {
      void requestSync();
    }
  });
  // Signal back after a dead zone: upload what waited.
  const network = Network.addNetworkStateListener((state) => {
    if (state.isInternetReachable) {
      void requestSync();
    }
  });
  const saved = useFinishedDriveStore.subscribe((next, prev) => {
    if (next.saveStatus === 'saved' && prev.saveStatus !== 'saved') {
      void requestSync();
    }
  });
  const auth = useAuthStore.subscribe((next, prev) => {
    if (next.status === 'signedIn' && prev.status !== 'signedIn') {
      void requestSync();
    } else if (next.status === 'signedOut' && prev.status !== 'signedOut') {
      // Expired sessions too, not only Sign out: the next account must never see these drives.
      wipeDb();
      resetSyncState();
    }
  });
  return () => {
    app.remove();
    network.remove();
    saved();
    auth();
  };
}

/** After sign-out: the next account starts from an empty local copy. */
export const resetSyncState = () => {
  lastPullAt = 0;
  useSyncStore.setState({ready: false, version: useSyncStore.getState().version + 1});
};
