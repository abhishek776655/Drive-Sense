import {haversineMeters} from './geo';

/**
 * Trip auto start / auto end and the fix filter, ported unchanged from mobile-expo's
 * useLiveTracking. Pure so the rules are tested without a device.
 */
export const AUTO_START_SPEED_MPS = 2.2;
export const AUTO_END_IDLE_SECONDS = 180;
/** A fix less accurate than this is dropped once there is a better one to keep. */
export const MAX_ACCEPTABLE_ACCURACY_M = 55;
const STABLE_IDLE_POINT_COUNT = 4;
const STABLE_IDLE_RADIUS_M = 18;
const STOPPED_MPS = 0.6;

type Fix = {latitude: number; longitude: number; speedMps: number | null; timestamp: number};

export const shouldAutoStart = (speedMps: number | null, hasVehicle: boolean): boolean =>
  hasVehicle && (speedMps ?? 0) >= AUTO_START_SPEED_MPS;

/** The last few fixes all stopped and within a small radius: parked, not crawling in traffic. */
export const hasStableIdleCluster = (fixes: Fix[]): boolean => {
  if (fixes.length < STABLE_IDLE_POINT_COUNT) {
    return false;
  }
  const cluster = fixes.slice(-STABLE_IDLE_POINT_COUNT);
  const anchor = cluster[0];
  return cluster.every((fix) => haversineMeters(anchor, fix) <= STABLE_IDLE_RADIUS_M && (fix.speedMps ?? 0) <= STOPPED_MPS);
};

/** Ended after the idle time (Settings, 3 minutes by default) without movement, once clearly parked. */
export const shouldAutoEnd = (lastMovementAt: number | null, now: number, recentFixes: Fix[], idleSeconds = AUTO_END_IDLE_SECONDS): boolean =>
  lastMovementAt != null && (now - lastMovementAt) / 1000 >= idleSeconds && hasStableIdleCluster(recentFixes);

/** "Ignore short drives" (Settings): under 300 m or under a minute is not worth keeping. */
export const SHORT_DRIVE_METERS = 300;
export const SHORT_DRIVE_SECONDS = 60;
export const isShortDrive = (distanceM: number, durationSeconds: number): boolean =>
  distanceM < SHORT_DRIVE_METERS || durationSeconds < SHORT_DRIVE_SECONDS;

/** Speed alert: fires on crossing the limit, and again only after dropping below it and a minute passing. */
export const SPEED_ALERT_REPEAT_MS = 60_000;
export interface SpeedAlertState {
  over: boolean;
  lastAlertAt: number | null;
}
export const nextSpeedAlert = (
  prev: SpeedAlertState,
  speedKmh: number,
  limitKmh: number,
  now: number,
): {state: SpeedAlertState; fire: boolean} => {
  if (speedKmh <= limitKmh) {
    return {state: {over: false, lastAlertAt: prev.lastAlertAt}, fire: false};
  }
  const rested = prev.lastAlertAt == null || now - prev.lastAlertAt >= SPEED_ALERT_REPEAT_MS;
  const fire = !prev.over && rested;
  return {state: {over: true, lastAlertAt: fire ? now : prev.lastAlertAt}, fire};
};

/** Drop a poor fix once there is a previous one; the first fix is always kept so the map can show something. */
export const isUsableFix = (accuracyM: number | null, hasPrevious: boolean): boolean =>
  !hasPrevious || accuracyM == null || accuracyM <= MAX_ACCEPTABLE_ACCURACY_M;
