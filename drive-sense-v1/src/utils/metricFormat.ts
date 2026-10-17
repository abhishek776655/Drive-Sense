import type {AppTheme} from '../theme/appTheme';

/**
 * Score bands. Colour carries the verdict, so a 95 and an 83 stop looking identical.
 */
export const scoreTone = (theme: AppTheme, score: number) => {
  if (score >= 90) {
    return theme.success;
  }
  if (score >= 70) {
    return theme.warning;
  }
  return theme.danger;
};

/**
 * Splits a formatted metric into its number and its trailing unit so each can be its own Text.
 * Keeping the unit inside the value string is what lets `16 km/h` wrap as `16 km/` + `h`.
 */
export const splitUnit = (value: string): {value: string; unit?: string} => {
  const match = /^(-?[\d.,]+)\s*(.*)$/.exec(value.trim());
  if (!match || !match[2]) {
    return {value};
  }
  // Compound values like `2h 34m` carry a second number in the remainder. Splitting those would
  // shrink the minutes to unit size, so they stay whole.
  if (/\d/.test(match[2])) {
    return {value: value.trim()};
  }
  return {value: match[1], unit: match[2]};
};
