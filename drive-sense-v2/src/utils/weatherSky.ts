/**
 * Weather card background: the colour of the sky outside. Clear day is light sky blue, cloud greys
 * it, rain and storms darken it, night is navy. Pure so the mapping is tested; the card only picks
 * the gradient for the current weather code and day/night.
 */
export type SkyKind = 'clear' | 'partly' | 'overcast' | 'fog' | 'drizzle' | 'rain' | 'storm' | 'snow';

export const skyKind = (code: number): SkyKind => {
  if (code === 0) {
    return 'clear';
  }
  if (code <= 2) {
    return 'partly';
  }
  if (code === 3) {
    return 'overcast';
  }
  if (code === 45 || code === 48) {
    return 'fog';
  }
  if (code >= 51 && code <= 57) {
    return 'drizzle';
  }
  if (code >= 95) {
    return 'storm';
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return 'snow';
  }
  return 'rain';
};

const DAY: Record<SkyKind, [string, string]> = {
  // Kept deep enough for white text to read.
  clear: ['#2A7DCF', '#56A4E2'],
  partly: ['#3A78B8', '#6E9DC8'],
  overcast: ['#5E7389', '#8B9CAE'],
  fog: ['#6F7D8B', '#9AA6B2'],
  drizzle: ['#3D5F86', '#6A87A8'],
  rain: ['#1F3B63', '#35587F'],
  storm: ['#171C36', '#2C3355'],
  snow: ['#6E8FAF', '#A9C2D8'],
};

const NIGHT: Record<SkyKind, [string, string]> = {
  clear: ['#1A1940', '#2B2A63'],
  partly: ['#1D2147', '#33386A'],
  overcast: ['#22283A', '#3A4258'],
  fog: ['#262B36', '#404857'],
  drizzle: ['#18233D', '#2B3B5E'],
  rain: ['#111A31', '#22314F'],
  storm: ['#0D1022', '#1E2340'],
  snow: ['#2A3550', '#46577A'],
};

/** Top-to-bottom gradient for the card. */
export const skyGradient = (code: number, isDay: boolean): [string, string] => (isDay ? DAY : NIGHT)[skyKind(code)];
