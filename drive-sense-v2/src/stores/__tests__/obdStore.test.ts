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
});
