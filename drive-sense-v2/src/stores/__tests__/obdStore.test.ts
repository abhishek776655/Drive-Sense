import {HISTORY_MS, useObdStore} from '../obdStore';
import type {ObdAdapter} from '../../db/obdRepos';

const adapter = (deviceId: string): ObdAdapter => ({
  vehicleId: 'v1',
  deviceId,
  deviceName: 'Vgate',
  vin: null,
  supported: [],
  lastSeen: '2026-10-25T08:00:00.000Z',
  lastState: null,
});

describe('obdStore', () => {
  beforeEach(() => useObdStore.getState().reset());

  it('keeps the latest value per PID', () => {
    const s = useObdStore.getState();
    s.putValue('rpm', 900, 1);
    s.putValue('rpm', 1500, 2);
    expect(useObdStore.getState().values.rpm).toEqual({v: 1500, at: 2});
  });

  it('keeps power and acceleration in each history point', () => {
    const s = useObdStore.getState();
    s.setDerived({fuelFlow: 2, economy: null, boost: null, gear: null, torqueNm: 100, powerKw: 30, accelMps2: 1.2});
    s.putValue('speed', 40, 1000);
    expect(useObdStore.getState().history.at(-1)).toMatchObject({power: 30, accel: 1.2, fuelFlow: 2});
  });

  it('adds a history point per speed reading and keeps 60 s', () => {
    const s = useObdStore.getState();
    s.putValue('rpm', 2000, 0);
    s.putValue('speed', 40, 0);
    s.putValue('speed', 50, HISTORY_MS / 2);
    s.putValue('speed', 60, HISTORY_MS + 1);
    const history = useObdStore.getState().history;
    expect(history.map((p) => p.speed)).toEqual([50, 60]);
    expect(history[0].rpm).toBe(2000);
  });

  it('starts over when a different adapter is set', () => {
    const s = useObdStore.getState();
    s.setAdapter(adapter('a'));
    s.putValue('rpm', 900, 1);
    s.setAdapter({...adapter('a'), vin: 'X'});
    expect(useObdStore.getState().values.rpm?.v).toBe(900);
    s.setAdapter(adapter('b'));
    expect(useObdStore.getState().values).toEqual({});
    expect(useObdStore.getState().link).toBe('waiting');
    s.setAdapter(null);
    expect(useObdStore.getState().link).toBe('none');
  });

  it('reads the check-engine status', () => {
    useObdStore.getState().setStatus({mil: true, codeCount: 3});
    expect(useObdStore.getState().mil).toEqual({on: true, codes: 3});
  });

  it('remembers when the engine last ran', () => {
    const s = useObdStore.getState();
    s.putValue('rpm', 900, 1000);
    s.putValue('rpm', 0, 2000);
    expect(useObdStore.getState().engineOnAt).toBe(1000);
  });

  it('adds up adapter distance and skips gaps', () => {
    const s = useObdStore.getState();
    s.putValue('speed', 36, 0); // 10 m/s
    s.putValue('speed', 36, 1000);
    s.putValue('speed', 72, 2000); // averages 15 m/s over this second
    s.putValue('speed', 72, 20_000); // 18 s gap: not counted
    expect(useObdStore.getState().distanceM).toBeCloseTo(25, 5);
  });
});
