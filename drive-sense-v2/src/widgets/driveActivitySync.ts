import {usePreferencesStore} from '../stores/preferencesStore';
import {useRecordingStore, type RecordingState} from '../stores/recordingStore';
import {widgetsNative, type ActivityHandle} from './native';
import {driveActivityProps, savedActivityProps, shouldPush, type DriveActivityProps} from './props';

/** Tapping the Live Activity opens the Drive tab. */
export const DRIVE_URL = 'drivesensev2://drive';
/** How long the "Drive saved" card stays on the Lock Screen and CarPlay after End. */
export const SAVED_FOR_MS = 15 * 60 * 1000;

let instance: ActivityHandle | null = null;
let lastProps: DriveActivityProps | null = null;
let lastPushAt = 0;

const isLive = (s: Pick<RecordingState, 'status' | 'startedAt'>) => s.status !== 'ready' && s.startedAt != null;

// A Live Activity is a nicety: whatever ActivityKit does, recording must carry on.
const warn = (what: string) => (error: unknown) => console.warn(`Live Activity ${what} failed`, error);

/**
 * Mirrors one recording-store change onto the Live Activity (spec 2026-10-17, CarPlay Live
 * Activity): a drive starting starts it, the running drive updates it at most every 5 s, and the
 * drive ending turns it into the "Drive saved" card. Exported for tests; the app goes through
 * `startDriveActivitySync`.
 */
export const syncDriveActivity = (next: RecordingState, prev: RecordingState, now = Date.now()) => {
  const native = widgetsNative();
  if (!native) {
    return;
  }
  const units = usePreferencesStore.getState().units;
  if (isLive(next)) {
    const props = driveActivityProps(next, units, now);
    if (!instance) {
      try {
        instance = native.activity.start(props, DRIVE_URL);
      } catch (error) {
        // Live Activities switched off in Settings, or the system refused: try again next drive.
        warn('start')(error);
        return;
      }
    } else if (shouldPush(lastProps, props, lastPushAt, now)) {
      instance.update(props).catch(warn('update'));
    } else {
      return;
    }
    lastProps = props;
    lastPushAt = now;
    return;
  }
  if (isLive(prev) && instance) {
    const ended = instance;
    instance = null;
    lastProps = null;
    ended.end(native.after(new Date(now + SAVED_FOR_MS)), savedActivityProps(prev, units, now), new Date(now)).catch(warn('end'));
  }
};

/**
 * Starts mirroring the recording store. Call once the recording has been restored from storage: a
 * drive still running after a relaunch adopts its Live Activity, and any left over from a crash with
 * no drive behind it are closed. Returns the unsubscribe function.
 */
export const startDriveActivitySync = (): (() => void) => {
  const native = widgetsNative();
  if (!native) {
    return () => {};
  }
  const state = useRecordingStore.getState();
  const running = native.activity.getInstances();
  const keep = isLive(state) ? running[0] : undefined;
  for (const orphan of running) {
    if (orphan !== keep) {
      orphan.end('immediate').catch(warn('cleanup'));
    }
  }
  instance = keep ?? null;
  lastProps = null;
  // Brings an adopted activity up to date, or starts one for a restored drive that has none.
  syncDriveActivity(state, state);
  return useRecordingStore.subscribe((next, prev) => syncDriveActivity(next, prev));
};

/** Test hook: forget the module-level instance between tests. */
export const resetDriveActivitySync = () => {
  instance = null;
  lastProps = null;
  lastPushAt = 0;
};
