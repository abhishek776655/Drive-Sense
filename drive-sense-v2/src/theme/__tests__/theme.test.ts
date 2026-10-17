import {DARK_PALETTE, LIGHT_PALETTE} from '../palettes';
import {resolveScheme, themeFor} from '../theme';

describe('theme', () => {
  it('both palettes define every token', () => {
    const darkKeys = Object.keys(DARK_PALETTE).sort();
    expect(Object.keys(LIGHT_PALETTE).sort()).toEqual(darkKeys);
    for (const palette of [DARK_PALETTE, LIGHT_PALETTE]) {
      for (const value of Object.values(palette)) {
        expect(value).not.toBe('');
        expect(value).not.toBeUndefined();
      }
    }
  });

  it('System follows the device, explicit choices override it', () => {
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', null)).toBe('dark');
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });

  it('keeps the same orange accent in both schemes', () => {
    expect(themeFor('light').colors.accent).toBe('#FF6D00');
    expect(themeFor('dark').colors.accent).toBe('#FF6D00');
    expect(themeFor('light').colors.canvas).toBe('#F5F5F4');
  });
});

describe('splitAlpha', () => {
  const {splitAlpha} = jest.requireActual('../color');
  it('separates rgba into colour and opacity for SVG stops', () => {
    expect(splitAlpha('rgba(255,255,255,0.55)')).toEqual({color: 'rgb(255,255,255)', opacity: 0.55});
    expect(splitAlpha('#FF6D00')).toEqual({color: '#FF6D00', opacity: 1});
  });
});
