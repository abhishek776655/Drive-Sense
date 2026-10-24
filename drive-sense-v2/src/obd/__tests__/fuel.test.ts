import type {ObdStats} from '../series';
import type {CarDrive} from '../../stats/carStats';
import {formatMoney, fuelCost, priceInUnits, pricePerLitreFrom, rangeEconomy, rangeKm} from '../fuel';

const NOW = Date.UTC(2026, 9, 25);
const stats = (avgL100km: number, fuelUsedL = 2): ObdStats => ({avgRpm: 2000, maxRpm: 3000, maxCoolantC: 90, fuelUsedL, avgL100km, idleS: 0, coverage: 1});
const drive = (vehicleId: string, daysAgo: number, l100: number): CarDrive => ({startMs: NOW - daysAgo * 86_400_000, vehicleId, durationS: 600, stats: stats(l100)});

describe('fuel money', () => {
  it('costs fuel at the price per litre', () => {
    expect(fuelCost(2.5, 105.5)).toBeCloseTo(263.75, 2);
    expect(fuelCost(2.5, null)).toBeNull();
    expect(fuelCost(null, 105.5)).toBeNull();
  });

  it('formats small amounts with paise and large ones whole', () => {
    expect(formatMoney(42.3, '₹')).toBe('₹42.30');
    expect(formatMoney(1240.4, '₹')).toBe('₹1,240');
    expect(formatMoney(3.8, '$')).toBe('$3.80');
  });

  it('converts between per litre and per gallon', () => {
    expect(priceInUnits(1, 'imperial')).toBeCloseTo(3.785, 3);
    expect(pricePerLitreFrom(priceInUnits(1.25, 'imperial'), 'imperial')).toBeCloseTo(1.25, 6);
    expect(priceInUnits(105.5, 'metric')).toBe(105.5);
  });
});

describe('range', () => {
  it('is fuel left over economy', () => {
    // Half of 40 L at 8 L/100 km: 250 km.
    expect(rangeKm(50, 40, 8)).toBeCloseTo(250, 6);
  });

  it('needs every piece', () => {
    expect(rangeKm(null, 40, 8)).toBeNull();
    expect(rangeKm(50, null, 8)).toBeNull();
    expect(rangeKm(50, 40, null)).toBeNull();
    expect(rangeKm(50, 40, 0)).toBeNull();
  });

  it('uses the last 30 days of this vehicle, else all its drives', () => {
    const drives = [drive('v1', 3, 6), drive('v1', 60, 12), drive('v2', 1, 20)];
    expect(rangeEconomy(drives, 'v1', NOW)).toBe(6);
    expect(rangeEconomy([drive('v1', 60, 12)], 'v1', NOW)).toBe(12);
    expect(rangeEconomy(drives, 'v3', NOW)).toBeNull();
  });
});
