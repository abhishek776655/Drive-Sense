import type {CarDrive} from '../carStats';
import {todayFuel} from '../todayFuel';

const drive = (startMs: number, fuelUsedL: number | null, avgL100km: number | null, vehicleId = 'v1'): CarDrive => ({
  startMs,
  vehicleId,
  durationS: 600,
  stats: {avgRpm: null, maxRpm: null, maxCoolantC: null, fuelUsedL, avgL100km, idleS: 0, coverage: 1},
});
const MIDNIGHT = Date.parse('2026-10-26T00:00:00+05:30');

describe("today's fuel", () => {
  it("adds today's saved drives and the live one: total fuel over total distance", () => {
    // 1 L over 20 km (5 L/100) + live 0.5 L over 5 km (10 L/100) → 1.5 L over 25 km = 6 L/100.
    const t = todayFuel([drive(MIDNIGHT + 3_600_000, 1, 5)], 'v1', MIDNIGHT, {fuelUsedL: 0.5, l100km: 10});
    expect(t?.fuelL).toBeCloseTo(1.5);
    expect(t?.l100km).toBeCloseTo(6);
  });

  it('leaves out yesterday and other vehicles', () => {
    const t = todayFuel([drive(MIDNIGHT - 1000, 9, 9), drive(MIDNIGHT + 1000, 9, 9, 'v2'), drive(MIDNIGHT + 2000, 1, 5)], 'v1', MIDNIGHT, null);
    expect(t?.fuelL).toBeCloseTo(1);
    expect(t?.l100km).toBeCloseTo(5);
  });

  it('is null with no fuel figures today', () => {
    expect(todayFuel([drive(MIDNIGHT + 1000, null, null)], 'v1', MIDNIGHT, null)).toBeNull();
    expect(todayFuel([], 'v1', MIDNIGHT, {fuelUsedL: null, l100km: null})).toBeNull();
  });
});
