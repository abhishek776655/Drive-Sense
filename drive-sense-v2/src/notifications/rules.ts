import type {Preferences} from '../stores/preferencesStore';
import type {RecordingState} from '../stores/recordingStore';
import {elapsedSeconds} from '../stores/recordingStore';
import {liveScore} from '../utils/liveScore';
import {distanceUnit, formatDistance, type UnitSystem} from '../utils/units';

/** A drive left running this long without moving gets the "you forgot" nudge. */
export const FORGOTTEN_AFTER_S = 15 * 60;
/** Re-arming the nudge on every GPS fix would be wasteful; once a minute is plenty. */
export const REARM_EVERY_MS = 60 * 1000;

export interface Notice {
  title: string;
  body: string;
}

type Drive = Pick<RecordingState, 'startedAt' | 'pausedMs' | 'pausedAt' | 'stats'>;

/** "Drive saved · 12.4 km · 23 min · Score 92", from the drive's last live state. */
export const driveSavedNotice = (drive: Drive, units: UnitSystem, endedAt: number): Notice => {
  const minutes = Math.round(elapsedSeconds(drive, endedAt) / 60);
  return {
    title: 'Drive saved',
    body: `${formatDistance(drive.stats.distanceM, units)} ${distanceUnit(units)} · ${minutes} min · Score ${liveScore(drive.stats)}`,
  };
};

export const FORGOTTEN_NOTICE: Notice = {title: 'You forgot to end your drive', body: 'Tap to stop it and save your stats.'};

/**
 * Whether a running drive should carry the "you forgot" nudge. With auto-stop on the app ends a
 * parked drive itself, so the nudge is only for people who turned auto-stop off.
 */
export const watchForgotten = (prefs: Pick<Preferences, 'notifications' | 'autoStop'>, status: RecordingState['status']): boolean =>
  prefs.notifications && !prefs.autoStop && status !== 'ready';
