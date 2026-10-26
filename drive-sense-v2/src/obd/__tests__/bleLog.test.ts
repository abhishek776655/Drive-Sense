import AsyncStorage from '@react-native-async-storage/async-storage';
import {clearBleLog, logBle, readBleLog} from '../bleLog';

describe('adapter launch log', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('keeps events in the order they happened, with their time', async () => {
    await logBle('first');
    await logBle('second');
    const log = await readBleLog();
    expect(log.map((e) => e.event)).toEqual(['first', 'second']);
    expect(Number.isNaN(Date.parse(log[0].at))).toBe(false);
  });

  it('does not lose events logged back to back', async () => {
    await Promise.all([logBle('a'), logBle('b'), logBle('c')]);
    expect((await readBleLog()).map((e) => e.event)).toEqual(['a', 'b', 'c']);
  });

  it('keeps only the most recent 40', async () => {
    for (let i = 0; i < 45; i++) {
      await logBle(`event ${i}`);
    }
    const log = await readBleLog();
    expect(log).toHaveLength(40);
    expect(log[0].event).toBe('event 5');
    expect(log[39].event).toBe('event 44');
  });

  it('reads an unreadable log as empty and carries on', async () => {
    await AsyncStorage.setItem('ble_launch_log_v1', '{not json');
    expect(await readBleLog()).toEqual([]);
    await logBle('after');
    expect((await readBleLog()).map((e) => e.event)).toEqual(['after']);
  });

  it('clears', async () => {
    await logBle('x');
    await clearBleLog();
    expect(await readBleLog()).toEqual([]);
  });
});
