import {DEFAULT_STATS, MAX_STATS, moveStat, sanitizeSettings, toggleStat} from '../driveSettingsStore';

describe('stat picker', () => {
  it('removes a chosen stat and appends a new one', () => {
    expect(toggleStat(['distance', 'time'], 'time')).toEqual(['distance']);
    expect(toggleStat(['distance'], 'heading')).toEqual(['distance', 'heading']);
  });

  it('never holds more than 6', () => {
    expect(DEFAULT_STATS).toHaveLength(MAX_STATS);
    expect(toggleStat(DEFAULT_STATS, 'accuracy')).toBe(DEFAULT_STATS);
  });

  it('reorders and ignores moves past either end', () => {
    expect(moveStat(['distance', 'time', 'events'], 'events', -1)).toEqual(['distance', 'events', 'time']);
    expect(moveStat(['distance', 'time'], 'distance', -1)).toEqual(['distance', 'time']);
  });

  it('sanitizes stored settings from older or corrupt data', () => {
    const settings = sanitizeSettings({stats: ['distance', 'bogus', 'time'], gaugeStyle: 'hologram', scale: 999, mode: 'gauge'});
    expect(settings.stats).toEqual(['distance', 'time']);
    expect(settings.gaugeStyle).toBe('arc');
    expect(settings.scale).toBe('auto');
    expect(settings.mode).toBe('gauge');
    expect(sanitizeSettings(null).stats).toEqual(DEFAULT_STATS);
    expect(sanitizeSettings(null).tilt3d).toBe(true);
    expect(sanitizeSettings({tilt3d: false}).tilt3d).toBe(false);
  });

  it('keeps each of the nine gauge styles', () => {
    for (const style of ['ring', 'retro', 'tape', 'heritage', 'neon']) {
      expect(sanitizeSettings({gaugeStyle: style}).gaugeStyle).toBe(style);
    }
  });
});

describe('map overlays', () => {
  it('show the compass and hide coordinates unless set otherwise', () => {
    expect(sanitizeSettings({})).toMatchObject({showCompass: true, showCoordinates: false});
    expect(sanitizeSettings({showCompass: false, showCoordinates: true})).toMatchObject({showCompass: false, showCoordinates: true});
  });
});
