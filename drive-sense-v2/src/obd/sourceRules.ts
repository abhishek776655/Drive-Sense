import type {Sample} from '../stores/recordingStore';
import type {PidKey} from './pids';

/**
 * Which source wins when the phone and the OBD-II adapter both measure something (spec 2026-10-25,
 * telemetry sources, section 1). Pure, so every rule is tested without a phone or a car.
 */

/** An adapter reading older than this is not used for a fix. */
export const ADAPTER_FRESH_MS = 2000;
/** A drive ends this long after the engine stops (auto start-stop at lights is shorter). */
export const ENGINE_OFF_END_S = 60;
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

/**
 * When a drive should end because the engine stopped: the time it stopped, or null. Needs the
 * engine seen running during this drive, no running reading for `ENGINE_OFF_END_S`, and GPS not
 * showing the car moving lately.
 */
export const engineEndAt = ({
  engineOnAt,
  startedAt,
  now,
  lastMovementAt,
  engineRunningNow,
}: {
  engineOnAt: number | null;
  startedAt: number;
  now: number;
  lastMovementAt: number | null;
  engineRunningNow: boolean;
}): number | null => {
  if (engineRunningNow || engineOnAt == null || engineOnAt < startedAt) {
    return null;
  }
  if (now - engineOnAt < ENGINE_OFF_END_S * 1000) {
    return null;
  }
  if (lastMovementAt != null && lastMovementAt > engineOnAt && now - lastMovementAt < RECENT_MOVEMENT_S * 1000) {
    return null;
  }
  return engineOnAt;
};
