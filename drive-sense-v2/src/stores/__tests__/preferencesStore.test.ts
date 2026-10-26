import AsyncStorage from '@react-native-async-storage/async-storage';
import {DEFAULT_PREFERENCES, sanitizePreferences, usePreferencesStore} from '../preferencesStore';

describe('preferences', () => {
  it('falls back to defaults for anything unknown', () => {
    expect(sanitizePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(sanitizePreferences({units: 'parsecs', autoStopMinutes: 7, autoStart: 'yes'})).toEqual(DEFAULT_PREFERENCES);
  });

  it('keeps valid values and snaps the alert to the 10 km/h steps within range', () => {
    const p = sanitizePreferences({units: 'imperial', mapStyle: 'satellite', autoStopMinutes: 10, speedAlertKmh: 87, autoStart: false});
    expect(p).toMatchObject({units: 'imperial', mapStyle: 'satellite', autoStopMinutes: 10, speedAlertKmh: 90, autoStart: false});
    expect(sanitizePreferences({speedAlertKmh: 500}).speedAlertKmh).toBe(150);
    expect(sanitizePreferences({speedAlertKmh: 5}).speedAlertKmh).toBe(40);
  });

  it('saves a change and loads it back', async () => {
    await usePreferencesStore.getState().set({units: 'imperial', speedAlert: true});
    const saved = (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1);
    expect(JSON.parse(saved[1])).toMatchObject({units: 'imperial', speedAlert: true});
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(saved[1]);
    usePreferencesStore.setState({...DEFAULT_PREFERENCES, hydrated: false});
    await usePreferencesStore.getState().hydrate();
    expect(usePreferencesStore.getState()).toMatchObject({units: 'imperial', speedAlert: true, hydrated: true});
  });
});

describe('cluster stat choices', () => {
  it('lists every stat until a choice is made', () => {
    const p = sanitizePreferences({});
    expect(p.clusterCarStats).toContain('odometer');
    expect(p.clusterDriveStats).toContain('avgSpeed');
  });

  it('keeps a stored choice, dropping unknown keys', () => {
    const p = sanitizePreferences({clusterCarStats: ['fuel', 'warp'], clusterDriveStats: []});
    expect(p.clusterCarStats).toEqual(['fuel']);
    expect(p.clusterDriveStats).toEqual([]);
  });
});

describe('mapTypeFor', () => {
  const {mapTypeFor} = jest.requireActual('../../hooks/useMapType');
  it('uses the muted map on iOS only', () => {
    expect(mapTypeFor('muted', 'ios')).toBe('mutedStandard');
    expect(mapTypeFor('muted', 'android')).toBe('standard');
    expect(mapTypeFor('satellite', 'ios')).toBe('satellite');
  });

  it('keeps a sane fuel price, currency and tank sizes', () => {
    const p = sanitizePreferences({fuelPrice: 105.5, currency: '€', tankLitres: {v1: 45, v2: 2, v3: 'big', v4: 900}});
    expect(p).toMatchObject({fuelPrice: 105.5, currency: '€', tankLitres: {v1: 45}});
    expect(sanitizePreferences({fuelPrice: -3, currency: 'DM'})).toMatchObject({fuelPrice: null, currency: '₹', tankLitres: {}});
  });

  it('keeps known cluster dial and gauge styles, else the defaults', () => {
    expect(sanitizePreferences({clusterSpeedDial: 'needle', clusterRevDial: 'arc', clusterGaugeStyle: 'ring'})).toMatchObject({clusterSpeedDial: 'needle', clusterRevDial: 'arc', clusterGaugeStyle: 'ring'});
    expect(sanitizePreferences({clusterSpeedDial: 'tape', clusterGaugeStyle: 'pie'})).toMatchObject({clusterSpeedDial: 'arc', clusterRevDial: 'arc', clusterGaugeStyle: 'arc'});
    expect(sanitizePreferences({clusterPhoneDial: 'compass'}).clusterPhoneDial).toBe('compass');
    expect(sanitizePreferences({clusterRevDial: 'segment'}).clusterRevDial).toBe('segment');
    expect(sanitizePreferences({clusterLeftView: 'compass', clusterRightView: 'warp'})).toMatchObject({clusterLeftView: 'compass', clusterRightView: 'main'});
    expect(sanitizePreferences({clusterPhoneDial: 'radar'}).clusterPhoneDial).toBe('g');
  });
});
