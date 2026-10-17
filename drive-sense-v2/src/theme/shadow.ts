import type {AppTheme} from './theme';

/**
 * The soft lift under cards and floating controls (Rovy): wide and faint, never an outline.
 * `small` is for pills and round buttons, which sit closer to the surface.
 */
export const softShadow = (c: AppTheme['colors'], size: 'card' | 'small' = 'card') =>
  size === 'card'
    ? {shadowColor: c.cardShadow, shadowOpacity: c.cardShadowOpacity, shadowRadius: 22, shadowOffset: {width: 0, height: 8}, elevation: 4}
    : {shadowColor: c.cardShadow, shadowOpacity: c.cardShadowOpacity * 0.85, shadowRadius: 12, shadowOffset: {width: 0, height: 4}, elevation: 3};
