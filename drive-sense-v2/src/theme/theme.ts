import {DARK_PALETTE, LIGHT_PALETTE, ORANGE_ACCENT, type Accent, type Palette} from './palettes';

export type ColorScheme = 'dark' | 'light';
export type AppearancePreference = 'system' | ColorScheme;

export const FONT = {
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
} as const;

export interface AppTheme {
  scheme: ColorScheme;
  colors: Palette & {
    accent: string;
    accentDeep: string;
    onAccent: string;
    /** Text and icons over a photo, and the dark fade under them; the same in both appearances. */
    onPhoto: string;
    photoShade: string;
  };
  font: typeof FONT;
  radius: {card: number; hero: number; pill: number};
  space: {cardGap: number; screen: number};
}

/** Theme is `{palette, accent}` in, tokens out, so a new accent never touches a component. */
export const buildTheme = (palette: Palette, accent: Accent, scheme: ColorScheme): AppTheme => ({
  scheme,
  colors: {...palette, accent: accent.base, accentDeep: accent.deep, onAccent: '#FFFFFF', onPhoto: '#FFFFFF', photoShade: '#000000'},
  font: FONT,
  radius: {card: 24, hero: 26, pill: 999},
  space: {cardGap: 10, screen: 16},
});

export const PALETTES: Record<ColorScheme, Palette> = {dark: DARK_PALETTE, light: LIGHT_PALETTE};

/** System follows the phone; a phone that reports nothing falls back to dark, the brand default. */
export const resolveScheme = (
  preference: AppearancePreference,
  system: ColorScheme | null | undefined | 'unspecified',
): ColorScheme => {
  if (preference !== 'system') {
    return preference;
  }
  return system === 'light' ? 'light' : 'dark';
};

export const themeFor = (scheme: ColorScheme): AppTheme => buildTheme(PALETTES[scheme], ORANGE_ACCENT, scheme);
