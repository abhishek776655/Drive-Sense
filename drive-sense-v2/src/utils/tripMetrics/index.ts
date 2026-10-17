import type {Sample} from '../../stores/recordingStore';
import {GRAVITY_MPS2, HARSH_BRAKE_MPS2, RAPID_ACCELERATION_MPS2} from '../drivingThresholds';
import {ACCELERATION_PENALTY_WEIGHT, BRAKING_PENALTY_WEIGHT, OVERSPEED_PENALTY_WEIGHT} from '../liveScore';

/**
 * A drive's numbers, computed on the phone from every recorded fix (local-first part 2b). Each
 * function is a line-for-line port of the backend service named beside it, so the phone and the
 * server agree on the same points; the tests replay the backend's own test cases.
 */

export const OVERSPEED_MPS = 27.78;

export type TripEventKind = 'harsh_brake' | 'rapid_acceleration' | 'overspeed';

export interface PhoneEvent {
  event_type: TripEventKind;
  intensity: number;
  occurred_at: string;
  latitude: number;
  longitude: number;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const intensityOf = (raw: number) => Math.max(0, round3(raw));

/** `driving_event_detection_service.detect_driving_events`. */
export function detectEvents(
  points: Sample[],
  thresholds = {harshBrakingMps2: HARSH_BRAKE_MPS2, rapidAccelerationMps2: RAPID_ACCELERATION_MPS2, overspeedMps: OVERSPEED_MPS},
): PhoneEvent[] {
  const ordered = [...points].sort((a, b) => a.timestamp - b.timestamp);
  const events: PhoneEvent[] = [];
  let previous: Sample | null = null;
  let wasOverspeeding = false;
  const at = (p: Sample, event_type: TripEventKind, intensity: number): PhoneEvent => ({
    event_type,
    intensity,
    occurred_at: new Date(p.timestamp).toISOString(),
    latitude: p.latitude,
    longitude: p.longitude,
  });
  for (const point of ordered) {
    if (point.speedMps != null) {
      const overspeeding = point.speedMps > thresholds.overspeedMps;
      if (overspeeding && !wasOverspeeding) {
        events.push(at(point, 'overspeed', intensityOf(point.speedMps / thresholds.overspeedMps)));
      }
      wasOverspeeding = overspeeding;
    }
    if (previous == null || previous.speedMps == null || point.speedMps == null) {
      previous = point;
      continue;
    }
    const dt = (point.timestamp - previous.timestamp) / 1000;
    if (dt <= 0) {
      previous = point;
      continue;
    }
    const accel = (point.speedMps - previous.speedMps) / dt;
    if (accel <= thresholds.harshBrakingMps2) {
      events.push(at(point, 'harsh_brake', intensityOf(Math.abs(accel) / Math.abs(thresholds.harshBrakingMps2))));
    } else if (accel >= thresholds.rapidAccelerationMps2) {
      events.push(at(point, 'rapid_acceleration', intensityOf(accel / thresholds.rapidAccelerationMps2)));
    }
    previous = point;
  }
  return events;
}

/** `driving_score_service.calculate_driving_score` (overspeed "duration" is the floored Σ intensity). */
export function scoreFor(events: PhoneEvent[]): number {
  const brakes = events.filter((e) => e.event_type === 'harsh_brake').length;
  const accels = events.filter((e) => e.event_type === 'rapid_acceleration').length;
  const overspeed = Math.trunc(events.filter((e) => e.event_type === 'overspeed').reduce((sum, e) => sum + e.intensity, 0));
  const score = 100 - brakes * BRAKING_PENALTY_WEIGHT - accels * ACCELERATION_PENALTY_WEIGHT - overspeed * OVERSPEED_PENALTY_WEIGHT;
  return Math.max(0, Math.min(100, Math.trunc(score)));
}

// ── turns: `turn_detection_service.detect_turns` ──────────────────────────────

const TURN_MIN_DEGREES = 60;
const TURN_WINDOW_SECONDS = 8;
const MOVING_MIN_MPS = 3;
const BEARING_MIN_STEP_M = 4;
const TURN_MAX_GAP_SECONDS = 5;

const rad = (d: number) => (d * Math.PI) / 180;

const distanceM = (a: Sample, b: Sample) => {
  const lat1 = rad(a.latitude);
  const lat2 = rad(b.latitude);
  const h = Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 2 * 6_371_000 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const bearing = (a: Sample, b: Sample) => {
  const lat1 = rad(a.latitude);
  const lat2 = rad(b.latitude);
  const dlon = rad(b.longitude - a.longitude);
  const y = Math.sin(dlon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dlon);
  return (((Math.atan2(y, x) * 180) / Math.PI) % 360 + 360) % 360;
};

/** Shortest signed turn in degrees; positive is clockwise (right). Python's % floors, so mirror it. */
export const signedDelta = (previous: number, current: number) => ((((current - previous + 540) % 360) + 360) % 360) - 180;

export function detectTurns(points: Sample[]): {left: number; right: number} {
  let left = 0;
  let right = 0;
  let window: {t: number; delta: number}[] = [];
  let previous: {t: number; heading: number} | null = null;
  points.forEach((point, index) => {
    const moving = (point.speedMps ?? 0) >= MOVING_MIN_MPS;
    let heading = point.headingDeg != null && point.headingDeg >= 0 && point.headingDeg <= 360 ? point.headingDeg : null;
    if (heading == null && index > 0 && distanceM(points[index - 1], point) >= BEARING_MIN_STEP_M) {
      heading = bearing(points[index - 1], point);
    }
    const t = point.timestamp / 1000;
    if (heading == null || !moving) {
      previous = null;
      window = [];
      return;
    }
    if (previous != null && t - previous.t > TURN_MAX_GAP_SECONDS) {
      window = [];
    }
    if (previous != null) {
      window.push({t, delta: signedDelta(previous.heading, heading)});
      while (window.length > 0 && t - window[0].t > TURN_WINDOW_SECONDS) {
        window.shift();
      }
      const total = window.reduce((sum, w) => sum + w.delta, 0);
      if (Math.abs(total) >= TURN_MIN_DEGREES) {
        if (total > 0) {
          right += 1;
        } else {
          left += 1;
        }
        window = [];
      }
    }
    previous = {t, heading};
  });
  return {left, right};
}

// ── G-force: `g_force_service` ────────────────────────────────────────────────

const G_MAX_GAP_SECONDS = 5;
const G_MIN_GAP_SECONDS = 0.5;
const MAX_PLAUSIBLE_G = 1.5;
const MIN_MEANINGFUL_G = 0.02;

/** `estimate_max_g_from_speeds`: the hardest brake or launch between fixes, from GPS speed. */
export function estimateMaxG(points: Sample[]): number | null {
  let best: number | null = null;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a.speedMps == null || b.speedMps == null) {
      continue;
    }
    const dt = (b.timestamp - a.timestamp) / 1000;
    if (dt < G_MIN_GAP_SECONDS || dt > G_MAX_GAP_SECONDS) {
      continue;
    }
    const g = Math.abs(b.speedMps - a.speedMps) / dt / GRAVITY_MPS2;
    if (g > MAX_PLAUSIBLE_G) {
      continue;
    }
    best = best == null ? g : Math.max(best, g);
  }
  return best != null && best >= MIN_MEANINGFUL_G ? best : null;
}

/** The sensor peak when the phone measured one (as the server keeps it), else the GPS estimate. */
export function maxGFor(points: Sample[]): {value: number | null; source: 'sensor' | 'gps' | null} {
  const peaks = points.map((p) => p.peakG).filter((g): g is number => g != null && g >= 0 && g <= 5);
  if (peaks.length > 0) {
    return {value: Math.max(...peaks), source: 'sensor'};
  }
  const estimate = estimateMaxG(points);
  return {value: estimate, source: estimate != null ? 'gps' : null};
}

// ── the whole drive ───────────────────────────────────────────────────────────

/** Below this a fix counts as standing still (lights, traffic) for idle time. */
export const IDLE_BELOW_MPS = 1;

/** Seconds spent standing still between fixes (gaps over a minute are not counted: no signal). */
export function idleSeconds(points: Sample[]): number {
  let idle = 0;
  for (let i = 1; i < points.length; i++) {
    const dt = (points[i].timestamp - points[i - 1].timestamp) / 1000;
    if (dt > 0 && dt <= 60 && (points[i].speedMps ?? 0) < IDLE_BELOW_MPS) {
      idle += dt;
    }
  }
  return Math.round(idle);
}

export interface TripMetrics {
  events: PhoneEvent[];
  score: number;
  leftTurns: number;
  rightTurns: number;
  maxG: number | null;
  maxGSource: 'sensor' | 'gps' | null;
  idleSeconds: number;
}

export function tripMetrics(points: Sample[]): TripMetrics {
  const ordered = [...points].sort((a, b) => a.timestamp - b.timestamp);
  const events = detectEvents(ordered);
  const turns = detectTurns(ordered);
  const g = maxGFor(ordered);
  return {
    events,
    score: scoreFor(events),
    leftTurns: turns.left,
    rightTurns: turns.right,
    maxG: g.value,
    maxGSource: g.source,
    idleSeconds: idleSeconds(ordered),
  };
}
