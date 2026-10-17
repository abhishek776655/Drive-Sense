import {hasStableIdleCluster, isUsableFix, shouldAutoEnd, shouldAutoStart} from '../autoTrip';

const fix = (t: number, lat = 28.6, speed = 0) => ({latitude: lat, longitude: 77.2, speedMps: speed, timestamp: t});

describe('auto trip rules (ported from mobile-expo)', () => {
  it('auto-starts at 2.2 m/s with a vehicle', () => {
    expect(shouldAutoStart(2.2, true)).toBe(true);
    expect(shouldAutoStart(2.1, true)).toBe(false);
    expect(shouldAutoStart(20, false)).toBe(false);
    expect(shouldAutoStart(null, true)).toBe(false);
  });

  it('needs four stopped fixes within 18 m to count as parked', () => {
    expect(hasStableIdleCluster([fix(0), fix(1), fix(2)])).toBe(false);
    expect(hasStableIdleCluster([fix(0), fix(1), fix(2), fix(3)])).toBe(true);
    expect(hasStableIdleCluster([fix(0), fix(1), fix(2), fix(3, 28.6003)])).toBe(false);
    expect(hasStableIdleCluster([fix(0), fix(1), fix(2), fix(3, 28.6, 2)])).toBe(false);
  });

  it('auto-ends only after 180 s idle and parked', () => {
    const parked = [fix(0), fix(1), fix(2), fix(3)];
    expect(shouldAutoEnd(0, 179_000, parked)).toBe(false);
    expect(shouldAutoEnd(0, 180_000, parked)).toBe(true);
    expect(shouldAutoEnd(null, 999_000, parked)).toBe(false);
  });

  it('keeps the first fix whatever its accuracy, then drops fixes worse than 55 m', () => {
    expect(isUsableFix(500, false)).toBe(true);
    expect(isUsableFix(55, true)).toBe(true);
    expect(isUsableFix(56, true)).toBe(false);
    expect(isUsableFix(null, true)).toBe(true);
  });
});

describe('settings-driven trip rules', () => {
  const {isShortDrive, nextSpeedAlert, shouldAutoEnd} = jest.requireActual('../autoTrip');
  const parked = Array.from({length: 4}, (_, i) => ({latitude: 28.5, longitude: 77.1, speedMps: 0, timestamp: i * 1000}));

  it('waits the chosen idle time before auto-ending', () => {
    expect(shouldAutoEnd(0, 60_000, parked, 60)).toBe(true);
    expect(shouldAutoEnd(0, 60_000, parked, 300)).toBe(false);
  });

  it('calls a drive short when under 300 m or under a minute', () => {
    expect(isShortDrive(250, 600)).toBe(true);
    expect(isShortDrive(5000, 45)).toBe(true);
    expect(isShortDrive(5000, 600)).toBe(false);
  });

  it('alerts once on crossing the limit, then again only after dropping below and a minute', () => {
    let state = {over: false, lastAlertAt: null};
    const step = (kmh: number, at: number) => {
      const result = nextSpeedAlert(state, kmh, 100, at);
      state = result.state;
      return result.fire;
    };
    expect(step(90, 0)).toBe(false);
    expect(step(105, 1000)).toBe(true);
    expect(step(110, 2000)).toBe(false);
    expect(step(95, 3000)).toBe(false);
    expect(step(105, 10_000)).toBe(false); // below and back within the minute
    expect(step(95, 20_000)).toBe(false);
    expect(step(105, 70_000)).toBe(true);
  });
});
