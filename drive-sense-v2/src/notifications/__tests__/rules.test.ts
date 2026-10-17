import {EMPTY_STATS} from '../../stores/recordingStore';
import {driveSavedNotice, watchForgotten} from '../rules';

describe('notification rules', () => {
  it('summarises a saved drive in the chosen units', () => {
    const drive = {startedAt: 0, pausedMs: 0, pausedAt: null, stats: {...EMPTY_STATS, distanceM: 12_400, brakeCount: 1}};
    expect(driveSavedNotice(drive, 'metric', 23 * 60_000)).toEqual({title: 'Drive saved', body: '12.4 km · 23 min · Score 98'});
    expect(driveSavedNotice(drive, 'imperial', 23 * 60_000).body).toMatch(/^7\.7 mi/);
  });

  it('nudges about a forgotten drive only when auto-stop is off and notifications are on', () => {
    expect(watchForgotten({notifications: true, autoStop: false}, 'recording')).toBe(true);
    expect(watchForgotten({notifications: true, autoStop: false}, 'paused')).toBe(true);
    expect(watchForgotten({notifications: true, autoStop: true}, 'recording')).toBe(false);
    expect(watchForgotten({notifications: false, autoStop: false}, 'recording')).toBe(false);
    expect(watchForgotten({notifications: true, autoStop: false}, 'ready')).toBe(false);
  });
});
