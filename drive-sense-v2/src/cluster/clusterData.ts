import {DIP_LOW_V} from '../obd/battery';
import {fuelCost} from '../obd/fuel';
import type {PidKey} from '../obd/pids';
import {carState, type CarState} from '../obd/sourceRules';
import {COOLANT_ALERT_C, VOLTAGE_LOW_RUNNING} from '../obd/tiles';
import {compassPoint, isCoasting, shiftUpHint} from './motion';

/** Readings older than this are not shown (the adapter has gone quiet). */
const STALE_MS = 15_000;
const LOW_FUEL_PCT = 10;

/** Everything a cluster layout draws (spec 2026-10-25, cluster mode, section 2). */
export interface ClusterData {
  /** `adapter` when the car is answering; `phoneOnly` otherwise. */
  mode: 'adapter' | 'phoneOnly';
  speedKmh: number | null;
  rpm: number | null;
  gear: string | null;
  redline: number;
  g: {lon: number; lat: number} | null;
  loadPct: number | null;
  throttlePct: number | null;
  coasting: boolean;
  boostKpa: number | null;
  coolantC: number | null;
  fuelPct: number | null;
  /** What the fuel gauge shows: the live reading, else the last one (fuel doesn't change with the car off). */
  fuelGaugePct: number | null;
  rangeKm: number | null;
  voltage: number | null;
  intakeC: number | null;
  oilC: number | null;
  recording: boolean;
  driveS: number | null;
  distanceM: number | null;
  driveL100km: number | null;
  fuelUsedL: number | null;
  cost: number | null;
  instantL100km: number | null;
  /** From the car's torque PIDs; null without them or with the car not answering. */
  torqueNm: number | null;
  powerKw: number | null;
  /** The car's odometer: its last reading, kept with the engine off. */
  odometerKm: number | null;
  /** Fuel left in litres: the car's percent × the tank size, when one is set. */
  fuelLitres: number | null;
  /** This drive's distance over moving time (null when not recording). */
  avgSpeedMps: number | null;
  carState: CarState | null;
  /** Outside air: the car's ambient sensor, else the weather. */
  outsideC: number | null;
  /** Eight-point compass heading from GPS, null standing still. */
  heading: string | null;
  /** The gear to shift up to, when revving high in a low gear. */
  shiftUp: string | null;
  /** Harsh brakes and hard accelerations this drive (null when not recording). */
  events: {brake: number; accel: number} | null;
  /** The speed-alert limit when the alert is on. */
  speedLimitKmh: number | null;
  alerts: {checkEngine: boolean; lowBattery: boolean; hotCoolant: boolean; lowFuel: boolean};
}

export interface ClusterInput {
  now: number;
  values: Partial<Record<PidKey, {v: number; at: number}>>;
  derived: {economy: number | null; boost: number | null; gear: number | null; torqueNm?: number | null; powerKw?: number | null};
  mil: {on: boolean} | null;
  /** Lowest throttle seen this session, the closed-throttle reading. */
  closedThrottle: number | null;
  fuel: 'petrol' | 'diesel' | string | null;
  gpsSpeedMps: number | null;
  g: {lon: number; lat: number} | null;
  rangeKm: number | null;
  tankLitres: number | null;
  recording: {driveS: number; distanceM: number; avgSpeedMps?: number | null} | null;
  driveFuel: {l100km: number | null; fuelUsedL: number | null} | null;
  fuelPrice: number | null;
  batteryDipV: number | null;
  weatherC: number | null;
  headingDeg: number | null;
  events: {brake: number; accel: number} | null;
  speedLimitKmh: number | null;
}

/** Redlines: where most petrol engines stop pulling, diesels a good deal lower. */
export const REDLINE = {petrol: 6000, diesel: 4500} as const;

export const clusterData = (i: ClusterInput): ClusterData => {
  const fresh = (k: PidKey) => {
    const v = i.values[k];
    return v && i.now - v.at <= STALE_MS ? v.v : null;
  };
  const state = Object.keys(i.values).length > 0 ? carState(i.values, i.now) : null;
  // Phone-only whenever the car isn't answering: no adapter, out of range, or ignition off.
  const mode: ClusterData['mode'] = state == null || state === 'parked' ? 'phoneOnly' : 'adapter';
  const adapter = mode === 'adapter';
  const speedKmh = adapter && fresh('speed') != null ? fresh('speed') : i.gpsSpeedMps != null ? i.gpsSpeedMps * 3.6 : null;
  const rpm = adapter ? fresh('rpm') : null;
  const throttlePct = adapter ? fresh('throttle') : null;
  const coolantC = adapter ? fresh('coolant') : null;
  const voltage = adapter ? fresh('voltage') : null;
  const fuelPct = adapter ? fresh('fuelLevel') : null;
  const gear = i.derived.gear == null || !adapter ? null : i.derived.gear === 0 ? 'N' : String(i.derived.gear);
  return {
    mode,
    speedKmh,
    rpm,
    gear,
    redline: i.fuel === 'diesel' ? REDLINE.diesel : REDLINE.petrol,
    g: i.g,
    loadPct: adapter ? fresh('load') : null,
    throttlePct,
    coasting: adapter && isCoasting(throttlePct, i.closedThrottle, speedKmh),
    boostKpa: adapter ? i.derived.boost : null,
    coolantC,
    fuelPct,
    fuelGaugePct: fuelPct ?? i.values.fuelLevel?.v ?? null,
    rangeKm: i.rangeKm,
    voltage,
    intakeC: adapter ? fresh('intakeTemp') : null,
    oilC: adapter ? fresh('oilTemp') : null,
    recording: i.recording != null,
    driveS: i.recording?.driveS ?? null,
    distanceM: i.recording?.distanceM ?? null,
    driveL100km: i.driveFuel?.l100km ?? null,
    fuelUsedL: i.driveFuel?.fuelUsedL ?? null,
    cost: fuelCost(i.driveFuel?.fuelUsedL, i.fuelPrice),
    instantL100km: adapter ? i.derived.economy : null,
    torqueNm: adapter ? (i.derived.torqueNm ?? null) : null,
    powerKw: adapter ? (i.derived.powerKw ?? null) : null,
    // The odometer stays true with the engine off: the last reading, however old.
    odometerKm: i.values.odometer?.v ?? null,
    fuelLitres: fuelPct != null && i.tankLitres != null ? (fuelPct / 100) * i.tankLitres : null,
    avgSpeedMps: i.recording?.avgSpeedMps ?? null,
    carState: state,
    outsideC: (adapter ? fresh('ambient') : null) ?? i.weatherC,
    heading: compassPoint(i.headingDeg),
    shiftUp: adapter ? shiftUpHint(rpm, gear, i.fuel, throttlePct) : null,
    events: i.recording ? i.events : null,
    speedLimitKmh: i.speedLimitKmh,
    alerts: {
      // Only while the car answers: a light remembered from earlier is not the car now.
      checkEngine: adapter && (i.mil?.on ?? false),
      lowBattery: (voltage != null && (rpm ?? 0) > 0 && voltage < VOLTAGE_LOW_RUNNING) || (i.batteryDipV != null && i.batteryDipV < DIP_LOW_V),
      hotCoolant: coolantC != null && coolantC >= COOLANT_ALERT_C,
      lowFuel: fuelPct != null && fuelPct < LOW_FUEL_PCT,
    },
  };
};
