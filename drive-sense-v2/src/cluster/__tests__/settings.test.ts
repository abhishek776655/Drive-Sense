import {CAR_STATS, DRIVE_STATS, sanitizeStatKeys, shows, themeOf, THEMES} from '../settings';

describe('cluster themes', () => {
  it('names the look the dials and accent add up to', () => {
    expect(themeOf('arc', 'arc', 'auto')).toBe('normal');
    expect(themeOf('classic', 'classic', 'auto')).toBe('vintage');
    expect(themeOf('needle', 'needle', 'red')).toBe('sports');
    // A mix of the three is none of them.
    expect(themeOf('needle', 'arc', 'red')).toBeNull();
    expect(themeOf('arc', 'arc', 'teal')).toBeNull();
  });

  it('sports is needle dials in red', () => {
    expect(THEMES.sports).toEqual({speedDial: 'needle', revDial: 'needle', accent: 'red'});
  });
});

describe('cluster stat choices', () => {
  it('keeps what is known, in the order of the list, and drops the rest', () => {
    expect(sanitizeStatKeys(['odometer', 'oil', 'nonsense', 'oil'], CAR_STATS)).toEqual(['oil', 'odometer']);
  });

  it('falls back to every stat when nothing valid was stored', () => {
    expect(sanitizeStatKeys(undefined, DRIVE_STATS)).toEqual(DRIVE_STATS.map((s) => s.key));
    expect(sanitizeStatKeys('x', CAR_STATS)).toEqual(CAR_STATS.map((s) => s.key));
  });

  it('allows an empty choice (everything unticked)', () => {
    expect(sanitizeStatKeys([], CAR_STATS)).toEqual([]);
  });

  it('asks whether a stat is shown', () => {
    expect(shows(['oil'], 'oil')).toBe(true);
    expect(shows(['oil'], 'fuel')).toBe(false);
  });
});
