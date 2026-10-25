import type {Sample} from '../stores/recordingStore';
import type {PidKey} from './pids';

/**
 * Which source wins when the phone and the OBD-II adapter both measure something (spec 2026-10-25,
 * telemetry sources, section 1). Pure, so every rule is tested without a phone or a car.
 */

/** An adapter reading older than this is not used for a fix. */
export const ADAPTER_FRESH_MS = 2000;
/** GPS saying the car moved this recently means the adapter dropped out, not that the engine stopped. */
export const RECENT_MOVEMENT_S = 30;
/** GPS gaps longer than this are filled from adapter distance (tunnels, garages). */
export const GPS_GAP_FILL_S = 10;

export interface AdapterReading {
  speedMps: number | null;
  engineOn: boolean | null;
  /** Adapter distance so far (m), for filling GPS gaps. */
  distanceM: number;
}

type Values = Partial<Record<PidKey, {v: number; at: number}>>;

/** What the adapter says right now, or null when it has said nothing fresh. */
export const adapterReading = (obd: {values: Values; distanceM: number}, now: number): AdapterReading | null => {
  const fresh = (k: PidKey) => {
    const v = obd.values[k];
    return v && now - v.at <= ADAPTER_FRESH_MS ? v.v : null;
  };
  const kmh = fresh('speed');
  const rpm = fresh('rpm');
  if (kmh == null && rpm == null) {
    return null;
  }
  return {speedMps: kmh == null ? null : kmh / 3.6, engineOn: rpm == null ? null : rpm > 0, distanceM: obd.distanceM};
};

/** A fix with the adapter's speed (when it has one) and engine state. */
export const applyAdapter = (sample: Sample, reading: AdapterReading | null): Sample => {
  if (!reading) {
    return {...sample, speedSource: 'gps'};
  }
  return {
    ...sample,
    speedMps: reading.speedMps ?? sample.speedMps,
    speedSource: reading.speedMps != null ? 'obd' : 'gps',
    ...(reading.engineOn != null ? {engineOn: reading.engineOn} : {}),
  };
};

/**
 * Distance for one step between fixes. Normally the GPS step; after a long GPS gap with adapter
 * distance across it, the adapter's (the straight line between the fixes cuts every corner).
 */
export const fillGap = (gpsStepM: number, gapS: number, adapterStepM: number | null): {meters: number; fromAdapter: boolean} =>
  gapS > GPS_GAP_FILL_S && adapterStepM != null && adapterStepM > gpsStepM ? {meters: adapterStepM, fromAdapter: true} : {meters: gpsStepM, fromAdapter: false};

/** Time of the adapter's most recent answer of any kind (the car's computer is awake). */
export const lastAnswerAt = (values: Values): number | null => {
  let latest: number | null = null;
  for (const v of Object.values(values)) {
    if (v && (latest == null || v.at > latest)) {
      latest = v.at;
    }
  }
  return latest;
};

/**
 * Once the adapter has seen the engine run during a drive, it decides auto-pause and auto-stop
 * instead of GPS: a standstill with the engine running is traffic, not parking.
 */
export const adapterGoverns = (engineOnAt: number | null, startedAt: number): boolean => engineOnAt != null && engineOnAt >= startedAt;

/** When the car was last doing anything: moving, or (with the adapter in charge) its engine running. */
export const lastActiveAt = (lastMovementAt: number | null, engineOnAt: number | null, governs: boolean): number | null =>
  governs && engineOnAt != null ? Math.max(lastMovementAt ?? 0, engineOnAt) : lastMovementAt;

/**
 * When a drive with the adapter should end: the time the engine stopped, or null. The engine counts
 * as off whether the car's computer still answers with RPM 0 (ignition on, start-stop) or has gone
 * quiet (key out); either way the drive ends once it has been off for the Auto-stop time (`idleS`).
 * While it runs, `engineOnAt` keeps moving up, so a long standstill never ends the drive. GPS showing
 * movement means the adapter dropped out, not that the car stopped.
 */
export const engineEndAt = ({
  engineOnAt,
  startedAt,
  now,
  lastMovementAt,
  idleS,
}: {
  engineOnAt: number | null;
  startedAt: number;
  now: number;
  lastMovementAt: number | null;
  idleS: number;
}): number | null => {
  if (engineOnAt == null || !adapterGoverns(engineOnAt, startedAt)) {
    return null;
  }
  if (now - engineOnAt < idleS * 1000) {
    return null;
  }
  if (lastMovementAt != null && lastMovementAt > engineOnAt && now - lastMovementAt < RECENT_MOVEMENT_S * 1000) {
    return null; // GPS says it's moving: the adapter dropped out, the car didn't stop
  }
  return engineOnAt;
};

/** Readings older than this mean the car's computer has gone quiet (the slow engine-off poll is 10 s). */
export const QUIET_MS = 15_000;

export type CarState = 'running' | 'engineOff' | 'parked';

/**
 * What the car is doing, for the Telemetry indicator: engine running; engine off with the ignition
 * on (a long red light, auto start-stop); or parked, the computer asleep (ignition off).
 */
export const carState = (values: Values, now: number): CarState => {
  const answered = lastAnswerAt(values);
  if (answered == null || now - answered > QUIET_MS) {
    return 'parked';
  }
  const rpm = values.rpm;
  return rpm && now - rpm.at <= QUIET_MS && rpm.v > 0 ? 'running' : 'engineOff';
};
