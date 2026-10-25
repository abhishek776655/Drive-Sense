import {addSeconds, countsAsPhoneUse} from '../phoneUse';

describe('phone use while driving', () => {
  const base = {appActive: true, pathname: '/', speedMps: 15, recording: true};
  it('counts the app in use above 10 km/h, off the navigation screens', () => {
    expect(countsAsPhoneUse(base)).toBe(true);
    expect(countsAsPhoneUse({...base, pathname: '/drive'})).toBe(false);
    expect(countsAsPhoneUse({...base, pathname: '/telemetry'})).toBe(false);
    expect(countsAsPhoneUse({...base, pathname: '/cluster'})).toBe(false);
    expect(countsAsPhoneUse({...base, speedMps: 2})).toBe(false);
    expect(countsAsPhoneUse({...base, appActive: false})).toBe(false);
    expect(countsAsPhoneUse({...base, recording: false})).toBe(false);
  });

  it('adds whole seconds between ticks, skipping gaps (the app was away)', () => {
    expect(addSeconds(10, 1000, 2000)).toBe(11);
    expect(addSeconds(10, 1000, 60_000)).toBe(10);
  });
});
