/**
 * The standard Mode 01 PIDs the Telemetry tab reads (spec 2026-10-25, telemetry, section 1), with
 * the SAE J1979 formulas. `bytes` are the data bytes after the `41 <pid>` header.
 */
export type PidKey =
  | 'speed'
  | 'rpm'
  | 'throttle'
  | 'load'
  | 'coolant'
  | 'intakeTemp'
  | 'maf'
  | 'map'
  | 'baro'
  | 'fuelLevel'
  | 'voltage'
  | 'ambient'
  | 'oilTemp'
  | 'fuelRate'
  | 'fuelRateGs'
  | 'torquePct'
  | 'torqueRef'
  | 'gearCar'
  | 'odometer'
  | 'status'
  | 'runTime'
  | 'distSinceClear';

/** fast: every cycle; flow: every 2nd cycle (fuel needs it); slow: one per cycle in rotation; once: on connect. */
export type PidTier = 'fast' | 'flow' | 'slow' | 'once';

export interface PidDef {
  code: string;
  bytes: number;
  tier: PidTier;
  decode: (b: number[]) => number;
}

const word = (b: number[]) => b[0] * 256 + b[1];
const percent = (b: number[]) => (b[0] * 100) / 255;
const celsius = (b: number[]) => b[0] - 40;

export const PIDS: Record<PidKey, PidDef> = {
  speed: {code: '0D', bytes: 1, tier: 'fast', decode: (b) => b[0]},
  rpm: {code: '0C', bytes: 2, tier: 'fast', decode: (b) => word(b) / 4},
  throttle: {code: '11', bytes: 1, tier: 'fast', decode: percent},
  load: {code: '04', bytes: 1, tier: 'fast', decode: percent},
  maf: {code: '10', bytes: 2, tier: 'flow', decode: (b) => word(b) / 100},
  fuelRate: {code: '5E', bytes: 2, tier: 'flow', decode: (b) => word(b) / 20},
  // Engine fuel rate in g/s (bytes C, D are the whole vehicle's; one engine, same value).
  fuelRateGs: {code: '9D', bytes: 4, tier: 'flow', decode: (b) => word(b) / 50},
  // Actual engine torque as a percentage of the reference torque (negative while engine braking).
  torquePct: {code: '62', bytes: 1, tier: 'flow', decode: (b) => b[0] - 125},
  torqueRef: {code: '63', bytes: 2, tier: 'once', decode: word},
  // Byte A bit 0: gear reported; byte B high nibble: the gear (0 = neutral); C, D: the ratio × 1000.
  // −1 when not reported.
  gearCar: {code: 'A4', bytes: 4, tier: 'flow', decode: (b) => ((b[0] & 0x01) === 0 ? -1 : b[1] >> 4)},
  odometer: {code: 'A6', bytes: 4, tier: 'once', decode: (b) => (b[0] * 2 ** 24 + b[1] * 2 ** 16 + b[2] * 256 + b[3]) / 10},
  coolant: {code: '05', bytes: 1, tier: 'slow', decode: celsius},
  intakeTemp: {code: '0F', bytes: 1, tier: 'slow', decode: celsius},
  map: {code: '0B', bytes: 1, tier: 'slow', decode: (b) => b[0]},
  fuelLevel: {code: '2F', bytes: 1, tier: 'slow', decode: percent},
  voltage: {code: '42', bytes: 2, tier: 'slow', decode: (b) => word(b) / 1000},
  ambient: {code: '46', bytes: 1, tier: 'slow', decode: celsius},
  oilTemp: {code: '5C', bytes: 1, tier: 'slow', decode: celsius},
  baro: {code: '33', bytes: 1, tier: 'once', decode: (b) => b[0]},
  runTime: {code: '1F', bytes: 2, tier: 'once', decode: word},
  distSinceClear: {code: '31', bytes: 2, tier: 'once', decode: word},
  // Byte A: bit 7 is the check-engine light, bits 0–6 the stored code count (see `decodeStatus`).
  status: {code: '01', bytes: 4, tier: 'once', decode: (b) => b[0]},
};

export const PID_KEYS = Object.keys(PIDS) as PidKey[];

export const keyForCode = (code: string): PidKey | undefined => PID_KEYS.find((k) => PIDS[k].code === code.toUpperCase());

/** PID `01` byte A: the check-engine light and how many trouble codes are stored. */
export const decodeStatus = (a: number): {mil: boolean; codeCount: number} => ({mil: (a & 0x80) !== 0, codeCount: a & 0x7f});
