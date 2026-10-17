/**
 * Raw colour values. Components never import this file: they read semantic tokens from
 * `useAppTheme()`. Dark is measured from Rovy, Light from the Rovy light-mode screenshot; the
 * semantic accents are the iOS 26 system colours for each appearance.
 */
export interface Palette {
  canvas: string;
  card: string;
  control: string;
  controlActive: string;
  accentTint: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  separator: string;
  blue: string;
  cyan: string;
  mint: string;
  teal: string;
  purple: string;
  green: string;
  amber: string;
  red: string;
  /** Weather card stays navy in both appearances, as in Rovy. */
  weatherTop: string;
  weatherBottom: string;
  weatherIcon: string;
  weatherChip: string;
  weatherLine: string;
  glassFill: string;
  glassBorder: string;
  /** Glass rim: bright edge catching light at the top, dim edge at the bottom. */
  glassRimLight: string;
  glassRimDark: string;
  glassBlurTint: 'dark' | 'light';
  /** Dims the screen behind a sheet so the glass reads as a layer above it. */
  scrim: string;
  /** Rows and controls sitting on glass: translucent so the glass still reads through. */
  glassRow: string;
  /** Light cards lift with a shadow; dark cards rely on contrast against the black canvas. */
  cardShadow: string;
  cardShadowOpacity: number;
  /** Gauge mode background glow strength over the canvas. */
  glowOpacity: number;
  /** Fallback map backdrop where no native map renders (web, tests). */
  mapBackdrop: string;
  mapBlock: string;
}

export const DARK_PALETTE: Palette = {
  canvas: '#000000',
  // Rovy's dark surfaces are neutral greys on pure black (sampled from its screens, 2026-10-17).
  card: '#1C1C1C',
  control: '#1F1F1F',
  controlActive: '#0A0A0A',
  // A deep brown, not a bright tint: Rovy's vehicle tiles, icon discs and soft orange buttons.
  accentTint: '#1E1000',
  textPrimary: '#FFFFFF',
  textSecondary: '#A1A0A5',
  textTertiary: '#5E5E60',
  separator: '#2C2C2E',
  blue: '#0091FF',
  cyan: '#3AD3FD',
  mint: '#00DDC2',
  teal: '#00D4E4',
  purple: '#DD32F4',
  green: '#2BD35A',
  amber: '#FFB340',
  red: '#FF3E45',
  weatherTop: '#2B2A63',
  weatherBottom: '#1A1940',
  weatherIcon: '#F4F1E8',
  weatherChip: 'rgba(255,255,255,0.12)',
  weatherLine: 'rgba(255,255,255,0.3)',
  glassFill: 'rgba(30,30,36,0.28)',
  glassBorder: 'rgba(255,255,255,0.18)',
  glassRimLight: 'rgba(255,255,255,0.55)',
  glassRimDark: 'rgba(255,255,255,0.08)',
  glassBlurTint: 'dark',
  scrim: 'rgba(0,0,0,0.4)',
  glassRow: 'rgba(255,255,255,0.08)',
  cardShadow: '#000000',
  // A black canvas hides shadows; a faint one still separates stacked cards.
  cardShadowOpacity: 0.35,
  glowOpacity: 0.18,
  mapBackdrop: '#2D4466',
  mapBlock: '#3B5680',
};

export const LIGHT_PALETTE: Palette = {
  // Soft neutral off-white (not iOS's bluish grouped grey), so white cards lift off it.
  canvas: '#F5F5F4',
  card: '#FFFFFF',
  control: '#FFFFFF',
  controlActive: '#E5E5EA',
  accentTint: '#FFF0E1',
  textPrimary: '#000000',
  textSecondary: '#6E6E73',
  textTertiary: '#AEAEB2',
  separator: '#E5E5EA',
  blue: '#0088FF',
  cyan: '#00C0E8',
  mint: '#00C8B3',
  teal: '#00C3D0',
  purple: '#CB30E0',
  green: '#34C759',
  amber: '#FF9500',
  red: '#FF383C',
  weatherTop: '#2B2A63',
  weatherBottom: '#1A1940',
  weatherIcon: '#F4F1E8',
  weatherChip: 'rgba(255,255,255,0.12)',
  weatherLine: 'rgba(255,255,255,0.3)',
  glassFill: 'rgba(255,255,255,0.3)',
  glassBorder: 'rgba(255,255,255,0.75)',
  glassRimLight: 'rgba(255,255,255,0.95)',
  glassRimDark: 'rgba(0,0,0,0.10)',
  glassBlurTint: 'light',
  scrim: 'rgba(0,0,0,0.18)',
  glassRow: 'rgba(255,255,255,0.55)',
  cardShadow: '#1C1C1E',
  cardShadowOpacity: 0.1,
  glowOpacity: 0.12,
  mapBackdrop: '#DCE3EC',
  mapBlock: '#C8D2DE',
};

export interface Accent {
  /**
   * Hero fill, icons, orange text and filled buttons. White labels on it are ~2.8:1, so button
   * labels stay large and black-weight (decided 2026-10-13: one orange for every primary action).
   */
  base: string;
  /** Darker shade for text sitting on white over the accent (onboarding's white buttons). */
  deep: string;
}

export const ORANGE_ACCENT: Accent = {base: '#FF6D00', deep: '#A84300'};
