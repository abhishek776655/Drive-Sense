import {AppState} from 'react-native';
import {homeService} from '../services/homeService';
import {statsService} from '../services/statsService';
import {useAuthStore} from '../stores/authStore';
import {useFinishedDriveStore} from '../stores/finishedDriveStore';
import {usePreferencesStore} from '../stores/preferencesStore';
import {widgetsNative} from './native';
import {SIGNED_OUT_WEEK, weekWidgetProps} from './props';

/** Coming back to the app refreshes the widget at most this often. */
export const FOREGROUND_REFRESH_MS = 5 * 60 * 1000;

let lastRefreshAt = 0;

/** Fetches this week and the last drive and hands them to the widget. Never throws. */
export const refreshWeekWidget = async (now = Date.now()) => {
  const native = widgetsNative();
  if (!native || useAuthStore.getState().status !== 'signedIn') {
    return;
  }
  lastRefreshAt = now;
  try {
    const [overview, home] = await Promise.all([statsService.overview({period: 'week', vehicleId: null}), homeService.getHome()]);
    native.week.updateSnapshot(weekWidgetProps(overview, home.lastTrip, usePreferencesStore.getState().units, now));
  } catch (error) {
    // Offline or signed out mid-request: the widget keeps its last week until the next refresh.
    console.warn('Week widget refresh failed', error);
  }
};

/**
 * Keeps the week widget current (spec 2026-10-17, CarPlay Live Activity): on start, when a drive
 * is stored, when the app comes back to the foreground (at most every 5 min), when the units
 * change, and blank after sign-out. Returns the unsubscribe function.
 */
export const startWeekWidgetSync = (): (() => void) => {
  const native = widgetsNative();
  if (!native) {
    return () => {};
  }
  void refreshWeekWidget();
  const app = AppState.addEventListener('change', (next) => {
    if (next === 'active' && Date.now() - lastRefreshAt >= FOREGROUND_REFRESH_MS) {
      void refreshWeekWidget();
    }
  });
  const saved = useFinishedDriveStore.subscribe((next, prev) => {
    if (next.saveStatus === 'saved' && prev.saveStatus !== 'saved') {
      void refreshWeekWidget();
    }
  });
  const units = usePreferencesStore.subscribe((next, prev) => {
    if (next.units !== prev.units) {
      void refreshWeekWidget();
    }
  });
  const auth = useAuthStore.subscribe((next, prev) => {
    if (next.status === 'signedOut' && prev.status !== 'signedOut') {
      native.week.updateSnapshot(SIGNED_OUT_WEEK);
    } else if (next.status === 'signedIn' && prev.status !== 'signedIn') {
      void refreshWeekWidget();
    }
  });
  return () => {
    app.remove();
    saved();
    units();
    auth();
  };
};
