/**
 * Phone use while driving (spec 2026-10-25, telemetry sources, section 3): the app open and the
 * screen unlocked while moving above 10 km/h, except on the screens used to drive with (Drive,
 * Telemetry and the cluster). Shown on Trip Detail; not part of the score.
 */

export const PHONE_USE_MIN_MPS = 10 / 3.6;
const NAVIGATION = ['/drive', '/telemetry', '/cluster'];

export const countsAsPhoneUse = (s: {appActive: boolean; pathname: string; speedMps: number; recording: boolean}): boolean =>
  s.recording && s.appActive && s.speedMps > PHONE_USE_MIN_MPS && !NAVIGATION.includes(s.pathname);

/** Seconds between two ticks added to the total; a long gap means the app was away and counts nothing. */
export const addSeconds = (total: number, fromMs: number, toMs: number, maxGapS = 5): number => {
  const s = (toMs - fromMs) / 1000;
  return s > 0 && s <= maxGapS ? total + s : total;
};
