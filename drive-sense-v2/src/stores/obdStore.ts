import {create} from 'zustand';
import type {ObdAdapter} from '../db/obdRepos';
import type {PidKey} from '../obd/pids';

/**
 * Where the link to the car stands (spec 2026-10-25, telemetry, section 2):
 * none: no adapter paired for this vehicle; bluetoothOff / unauthorized / unavailable: the phone
 * can't; waiting: paired, adapter not reachable (car off); connecting: talking to it; live: engine
 * data flowing; engineOff: adapter answers, engine is off; unsupported: the car has no Mode 01.
 */
export type ObdLink = 'none' | 'bluetoothOff' | 'unauthorized' | 'unavailable' | 'waiting' | 'connecting' | 'live' | 'engineOff' | 'unsupported';

export interface ObdDerived {
  fuelFlow: number | null;
  economy: number | null;
  boost: number | null;
  gear: number | null;
}

export interface HistoryPoint {
  at: number;
  rpm: number | null;
  speed: number | null;
  fuelFlow: number | null;
}

/** Sparklines show this much. */
export const HISTORY_MS = 60_000;
/** Speed readings further apart than this don't count toward distance (the link dropped). */
const MAX_DISTANCE_STEP_S = 5;

const EMPTY_DERIVED: ObdDerived = {fuelFlow: null, economy: null, boost: null, gear: null};

interface ObdState {
  link: ObdLink;
  adapter: ObdAdapter | null;
  values: Partial<Record<PidKey, {v: number; at: number}>>;
  derived: ObdDerived;
  history: HistoryPoint[];
  supported: PidKey[];
  mil: {on: boolean; codes: number} | null;
  vin: string | null;
  error: string | null;
  /** Last time the engine was seen running (RPM > 0). */
  engineOnAt: number | null;
  /** Distance the adapter's speed covers, summed since the app started (m). Only differences matter. */
  distanceM: number;
  /** Lowest throttle reading this session: the closed-throttle position (it seldom reads 0). */
  throttleLow: number | null;
  setLink: (link: ObdLink, error?: string | null) => void;
  setAdapter: (adapter: ObdAdapter | null) => void;
  putValue: (key: PidKey, value: number, at: number) => void;
  setDerived: (derived: ObdDerived) => void;
  setSupported: (keys: PidKey[]) => void;
  setStatus: (status: {mil: boolean; codeCount: number}) => void;
  setVin: (vin: string) => void;
  /** Forget the live session (values stay for the "last seen" card until a new adapter). */
  endSession: () => void;
  reset: () => void;
}

const fresh = {link: 'none' as ObdLink, adapter: null, values: {}, derived: EMPTY_DERIVED, history: [], supported: [], mil: null, vin: null, error: null, engineOnAt: null, distanceM: 0, throttleLow: null};

export const useObdStore = create<ObdState>((set, get) => ({
  ...fresh,
  setLink: (link, error = null) => set({link, error}),
  setAdapter: (adapter) => set(adapter?.deviceId === get().adapter?.deviceId ? {adapter} : {...fresh, adapter, link: adapter ? 'waiting' : 'none'}),
  putValue: (key, value, at) => {
    const before = get().values;
    const values = {...before, [key]: {v: value, at}};
    if (key === 'rpm') {
      set(value > 0 ? {values, engineOnAt: at} : {values});
      return;
    }
    if (key === 'throttle') {
      const low = get().throttleLow;
      set({values, throttleLow: low == null || value < low ? value : low});
      return;
    }
    // One history point per speed reading (every cycle), carrying the latest of the others.
    if (key !== 'speed') {
      set({values});
      return;
    }
    const prev = before.speed;
    const stepS = prev ? (at - prev.at) / 1000 : 0;
    const distanceM = get().distanceM + (stepS > 0 && stepS <= MAX_DISTANCE_STEP_S ? (((prev?.v ?? 0) + value) / 2 / 3.6) * stepS : 0);
    const point: HistoryPoint = {at, rpm: values.rpm?.v ?? null, speed: value, fuelFlow: get().derived.fuelFlow};
    set({values, distanceM, history: [...get().history.filter((p) => at - p.at <= HISTORY_MS), point]});
  },
  setDerived: (derived) => set({derived}),
  setSupported: (supported) => set({supported}),
  setStatus: ({mil, codeCount}) => set({mil: {on: mil, codes: codeCount}}),
  setVin: (vin) => set({vin}),
  endSession: () => set({history: [], derived: EMPTY_DERIVED}),
  reset: () => set(fresh),
}));
