import * as Notifications from 'expo-notifications';
import {router} from 'expo-router';
import {usePreferencesStore} from '../stores/preferencesStore';
import {useRecordingStore, type RecordingState} from '../stores/recordingStore';
import {driveSavedNotice, FORGOTTEN_AFTER_S, FORGOTTEN_NOTICE, REARM_EVERY_MS, watchForgotten} from './rules';

const FORGOTTEN_ID = 'forgotten-drive';
const DRIVE_URL = '/drive';

// Shown as a banner even with the app open: a drive summary is worth seeing either way.
Notifications.setNotificationHandler({
  handleNotification: async () => ({shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false}),
});

/** Asks once (onboarding, Settings). True when notifications may be shown. */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) {
      return true;
    }
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

const allowed = async () => {
  if (!usePreferencesStore.getState().notifications) {
    return false;
  }
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
};

const show = async (title: string, body: string, identifier?: string, seconds?: number) => {
  if (!(await allowed())) {
    return;
  }
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {title, body, data: {url: DRIVE_URL}},
    trigger: seconds ? {type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds} : null,
  }).catch(() => undefined);
};

const cancelForgotten = () => Notifications.cancelScheduledNotificationAsync(FORGOTTEN_ID).catch(() => undefined);

let armedAt = 0;

/** Mirrors one recording change onto the two notifications. Exported for tests. */
export const syncDriveNotifications = (next: RecordingState, prev: RecordingState, now = Date.now()) => {
  const prefs = usePreferencesStore.getState();
  if (prev.status !== 'ready' && next.status === 'ready') {
    armedAt = 0;
    void cancelForgotten();
    // The summary screen already greets a drive ended with End; only an auto-ended one needs telling.
    if (next.justFinished?.autoEnded) {
      const notice = driveSavedNotice(prev, prefs.units, next.justFinished.endedAt);
      void show(notice.title, notice.body);
    }
    return;
  }
  if (!watchForgotten(prefs, next.status)) {
    if (armedAt) {
      armedAt = 0;
      void cancelForgotten();
    }
    return;
  }
  // Every movement pushes the nudge another 15 minutes out; standing still lets it fire.
  const moved = next.lastMovementAt !== prev.lastMovementAt || armedAt === 0;
  if (moved && now - armedAt >= REARM_EVERY_MS) {
    armedAt = now;
    void show(FORGOTTEN_NOTICE.title, FORGOTTEN_NOTICE.body, FORGOTTEN_ID, FORGOTTEN_AFTER_S);
  }
};

/** Starts both the recording mirror and tap handling (a tap opens the Drive tab). */
export function startDriveNotifications(): () => void {
  const recording = useRecordingStore.subscribe((next, prev) => syncDriveNotifications(next, prev));
  const taps = Notifications.addNotificationResponseReceivedListener((response) => {
    const url = response.notification.request.content.data?.url;
    if (typeof url === 'string') {
      router.push(url as never);
    }
  });
  return () => {
    recording();
    taps.remove();
  };
}

/** Test hook. */
export const resetDriveNotifications = () => {
  armedAt = 0;
};
