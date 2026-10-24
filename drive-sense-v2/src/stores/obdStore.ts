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

const fresh = {link: 'none' as ObdLink, adapter: null, values: {}, derived: EMPTY_DERIVED, history: [], supported: [], mil: null, vin: null, error: null};

export const useObdStore = create<ObdState>((set, get) => ({
  ...fresh,
  setLink: (link, error = null) => set({link, error}),
  setAdapter: (adapter) => set(adapter?.deviceId === get().adapter?.deviceId ? {adapter} : {...fresh, adapter, link: adapter ? 'waiting' : 'none'}),
  putValue: (key, value, at) => {
    const values = {...get().values, [key]: {v: value, at}};
    // One history point per speed reading (every cycle), carrying the latest of the others.
    if (key !== 'speed') {
      set({values});
      return;
    }
    const point: HistoryPoint = {at, rpm: values.rpm?.v ?? null, speed: value, fuelFlow: get().derived.fuelFlow};
    set({values, history: [...get().history.filter((p) => at - p.at <= HISTORY_MS), point]});
  },
  setDerived: (derived) => set({derived}),
  setSupported: (supported) => set({supported}),
  setStatus: ({mil, codeCount}) => set({mil: {on: mil, codes: codeCount}}),
  setVin: (vin) => set({vin}),
  endSession: () => set({history: [], derived: EMPTY_DERIVED}),
  reset: () => set(fresh),
}));
