/**
 * Battery health from the live link (spec 2026-10-25, telemetry sources, section 2): the resting
 * voltage with the engine off, and how far it dips while the starter turns the engine.
 */

/** Engine off this long before a voltage counts as resting. */
export const RESTING_AFTER_MS = 10_000;
/** The start dip is the lowest voltage from this long before the engine catches… */
export const DIP_BEFORE_MS = 2000;
/** …to this long after. */
export const DIP_AFTER_MS = 3000;
/** Below these a battery is worth a look. */
export const RESTING_LOW_V = 12.2;
export const DIP_LOW_V = 9.6;

export interface BatteryReading {
  /** Last resting voltage before this start; null when the engine wasn't off long enough. */
  restingV: number | null;
  startDipV: number;
  at: number;
}

/** Feed it every voltage and RPM reading; it reports once per engine start. */
export class BatteryWatch {
  private volts: {v: number; at: number}[] = [];
  private offSince: number | null = null;
  /** Engine-off readings old enough to count as resting, newest last (cranking ones are filtered at the start). */
  private restingLog: {v: number; at: number}[] = [];
  private pending: {startAt: number; resting: number | null} | null = null;

  constructor(private readonly onReading: (reading: BatteryReading) => void) {}

  voltage(v: number, at: number) {
    this.volts = [...this.volts.filter((r) => at - r.at <= DIP_BEFORE_MS + DIP_AFTER_MS), {v, at}];
    if (this.offSince != null && at - this.offSince >= RESTING_AFTER_MS) {
      this.restingLog = [...this.restingLog.filter((r) => at - r.at <= RESTING_AFTER_MS), {v, at}];
    }
    this.settle(at);
  }

  rpm(rpm: number, at: number) {
    if (rpm <= 0) {
      this.offSince ??= at;
    } else if (this.offSince != null) {
      // The engine just caught: measure the dip around this moment once the window has passed. The
      // resting figure is the last one from before the starter turned (the dip window), not a sag.
      const before = this.restingLog.filter((r) => r.at <= at - DIP_BEFORE_MS);
      this.pending = {startAt: at, resting: before.length > 0 ? before[before.length - 1].v : null};
      this.offSince = null;
      this.restingLog = [];
    }
    this.settle(at);
  }

  private settle(now: number) {
    if (!this.pending || now - this.pending.startAt < DIP_AFTER_MS) {
      return;
    }
    const {startAt, resting} = this.pending;
    this.pending = null;
    const window = this.volts.filter((r) => r.at >= startAt - DIP_BEFORE_MS && r.at <= startAt + DIP_AFTER_MS).map((r) => r.v);
    if (window.length > 0) {
      this.onReading({restingV: resting, startDipV: Math.min(...window), at: startAt});
    }
  }
}

/** The adapter's own supply reading (`ATRV`): "12.4V" → 12.4. */
export const parseVoltage = (raw: string): number | null => {
  const match = /(\d{1,2}(?:\.\d+)?)\s*V/i.exec(raw);
  return match ? Number(match[1]) : null;
};
