import type {LastTrip} from '../services/homeService';
import type {StatsOverview} from '../services/statsService';
import {avgSpeedMps, elapsedSeconds, type RecordingState} from '../stores/recordingStore';
import {DASH} from '../utils/format';
import {liveScore} from '../utils/liveScore';
import {distanceUnit, formatDistance, formatSpeed, speedUnit, type UnitSystem} from '../utils/units';

/**
 * What the Live Activity and the week widget show (spec 2026-10-17, CarPlay Live Activity). Built
 * here, in the app, because widget code runs in an isolated runtime that cannot import anything:
 * every string arrives already formatted in the user's units.
 */
export interface DriveActivityProps {
  state: 'recording' | 'paused' | 'saved';
  /** "23 min", "1 h 05". Minutes only, so the Lock Screen does not flicker every second. */
  time: string;
  distance: string;
  avgSpeed: string;
  score: string;
  /** "2 events" once saved, otherwise empty. */
  events: string;
}

export interface DriveWeekProps {
  signedIn: boolean;
  distance: string;
  unit: string;
  drives: string;
  score: string;
  /** Monday first, each 0–1 of the week's longest day. */
  bars: number[];
  /** Index of today in `bars`. */
  today: number;
  last: {route: string; detail: string} | null;
}

type LiveDrive = Pick<RecordingState, 'status' | 'startedAt' | 'pausedMs' | 'pausedAt' | 'stats'>;

/** Push at most this often while only the numbers change; a state change always goes through. */
export const PUSH_INTERVAL_MS = 5000;

export const activityTime = (seconds: number): string => {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
};

const withUnit = (value: string, unit: string) => (value === DASH ? DASH : `${value} ${unit}`);

export const driveActivityProps = (drive: LiveDrive, units: UnitSystem, now: number): DriveActivityProps => {
  const seconds = elapsedSeconds(drive, now);
  const {stats} = drive;
  return {
    state: drive.status === 'paused' ? 'paused' : 'recording',
    time: activityTime(seconds),
    distance: withUnit(formatDistance(stats.distanceM, units), distanceUnit(units)),
    avgSpeed: withUnit(formatSpeed(avgSpeedMps(stats.distanceM, stats.movingSeconds), units), speedUnit(units)),
    score: seconds > 0 ? String(liveScore(stats)) : DASH,
    events: '',
  };
};

/** The drive's last live state, restated as the "Drive saved" card left on screen after End. */
export const savedActivityProps = (drive: LiveDrive, units: UnitSystem, endedAt: number): DriveActivityProps => {
  const count = drive.stats.eventCount;
  return {
    ...driveActivityProps(drive, units, endedAt),
    state: 'saved',
    events: count === 1 ? '1 event' : `${count} events`,
  };
};

export const shouldPush = (prev: DriveActivityProps | null, next: DriveActivityProps, lastPushAt: number, now: number): boolean => {
  if (prev == null || prev.state !== next.state) {
    return true;
  }
  const changed = prev.time !== next.time || prev.distance !== next.distance || prev.score !== next.score || prev.avgSpeed !== next.avgSpeed;
  return changed && now - lastPushAt >= PUSH_INTERVAL_MS;
};

export const SIGNED_OUT_WEEK: DriveWeekProps = {
  signedIn: false,
  distance: DASH,
  unit: '',
  drives: '',
  score: DASH,
  bars: [0, 0, 0, 0, 0, 0, 0],
  today: 0,
  last: null,
};

/** First part of an address ("Office" from "Office, Sector 5, Delhi"). */
const place = (address: string | null): string | null => address?.split(',')[0]?.trim() || null;

const ago = (iso: string, now: number): string => {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
};

export const weekWidgetProps = (overview: StatsOverview, lastTrip: LastTrip | null, units: UnitSystem, now: number): DriveWeekProps => {
  const days = overview.trend.buckets.slice(0, 7).map((b) => b.distance_meters);
  while (days.length < 7) {
    days.push(0);
  }
  const longest = Math.max(...days);
  const scores = overview.trend.buckets.map((b) => b.avg_score).filter((s): s is number => s != null);
  const count = overview.summary.trip_count;
  const from = lastTrip ? place(lastTrip.startAddress) : null;
  const to = lastTrip ? place(lastTrip.endAddress) : null;
  return {
    signedIn: true,
    distance: formatDistance(overview.summary.distance_meters, units),
    unit: distanceUnit(units),
    drives: count === 1 ? '1 drive' : `${count} drives`,
    score: scores.length > 0 ? String(Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)) : DASH,
    bars: days.map((d) => (longest > 0 ? Math.round((d / longest) * 100) / 100 : 0)),
    // getDay() is Sunday-first; the week here starts on Monday.
    today: (new Date(now).getDay() + 6) % 7,
    last: lastTrip
      ? {
          route: from && to ? `${from} → ${to}` : (to ?? from ?? lastTrip.vehicleName),
          detail: `${withUnit(formatDistance(lastTrip.distanceMeters, units), distanceUnit(units))} · ${activityTime(lastTrip.durationSeconds)} · ${ago(lastTrip.startTime, now)}`,
        }
      : null,
  };
};
