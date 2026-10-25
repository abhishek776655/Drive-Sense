import {clusterData, type ClusterInput} from '../clusterData';

const NOW = 1_000_000;
const v = (value: number, ago = 500) => ({v: value, at: NOW - ago});

const base: ClusterInput = {
  now: NOW,
  values: {},
  derived: {economy: null, boost: null, gear: null},
  mil: null,
  closedThrottle: null,
  fuel: 'petrol',
  gpsSpeedMps: 10,
  g: {lon: 0.1, lat: 0},
  rangeKm: null,
  recording: null,
  driveFuel: null,
  fuelPrice: null,
  batteryDipV: null,
};

describe('cluster data', () => {
  it('runs phone-only without an adapter: GPS speed, no car values', () => {
    const d = clusterData(base);
    expect(d.mode).toBe('phoneOnly');
    expect(d.speedKmh).toBe(36);
    expect(d.rpm).toBeNull();
    expect(d.loadPct).toBeNull();
    expect(d.g).toEqual({lon: 0.1, lat: 0});
  });

  it('uses the adapter while the car answers', () => {
    const d = clusterData({
      ...base,
      values: {speed: v(72), rpm: v(2400), load: v(45), throttle: v(20), coolant: v(90), fuelLevel: v(8)},
      derived: {economy: 6.5, boost: 30, gear: 4},
      closedThrottle: 14,
      fuel: 'diesel',
    });
    expect(d).toMatchObject({mode: 'adapter', speedKmh: 72, rpm: 2400, gear: '4', redline: 4500, loadPct: 45, coasting: false, boostKpa: 30, carState: 'running'});
    expect(d.alerts.lowFuel).toBe(true);
  });

  it('shows coasting with the throttle closed while rolling', () => {
    const d = clusterData({...base, values: {speed: v(60), rpm: v(1500), throttle: v(15)}, closedThrottle: 14});
    expect(d.coasting).toBe(true);
  });

  it('falls back to phone-only once the ignition goes off', () => {
    const d = clusterData({...base, values: {speed: v(0, 20_000), rpm: v(0, 20_000)}});
    expect(d.mode).toBe('phoneOnly');
    expect(d.carState).toBe('parked');
    expect(d.rpm).toBeNull();
  });

  it('prices this drive\'s fuel and raises the warnings', () => {
    const d = clusterData({
      ...base,
      values: {rpm: v(900), coolant: v(116), voltage: v(12.6)},
      mil: {on: true},
      recording: {driveS: 600, distanceM: 8000},
      driveFuel: {l100km: 7, fuelUsedL: 0.56},
      fuelPrice: 100,
    });
    expect(d.cost).toBeCloseTo(56, 6);
    expect(d.alerts).toEqual({checkEngine: true, lowBattery: true, hotCoolant: true, lowFuel: false});
  });
});
