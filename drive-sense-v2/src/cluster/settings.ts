import type {ClusterAccent, DialStyle} from './accents';

/** The cluster's Settings page: ready-made looks and which stats its Car and Drive pages list. */

export type ClusterTheme = 'normal' | 'vintage' | 'sports';

/** A look is the two dial styles plus the accent; picking one sets all three. */
export const THEMES: Record<ClusterTheme, {speedDial: DialStyle; revDial: DialStyle; accent: ClusterAccent}> = {
  normal: {speedDial: 'arc', revDial: 'arc', accent: 'auto'},
  vintage: {speedDial: 'classic', revDial: 'classic', accent: 'auto'},
  // Needle dials in red.
  sports: {speedDial: 'needle', revDial: 'needle', accent: 'red'},
};
export const THEME_IDS = Object.keys(THEMES) as ClusterTheme[];
export const THEME_NAMES: Record<ClusterTheme, string> = {normal: 'Normal', vintage: 'Vintage', sports: 'Sports'};

/** The look the current dial styles and accent add up to, or null for a mix. */
export const themeOf = (speedDial: DialStyle, revDial: DialStyle, accent: ClusterAccent): ClusterTheme | null =>
  THEME_IDS.find((id) => THEMES[id].speedDial === speedDial && THEMES[id].revDial === revDial && THEMES[id].accent === accent) ?? null;

export interface StatOption {
  key: string;
  label: string;
}

/** What the Car page can list (the ones the car doesn't report simply don't show). */
export const CAR_STATS: StatOption[] = [
  {key: 'engineTemp', label: 'Engine temp'},
  {key: 'battery', label: 'Battery'},
  {key: 'boost', label: 'Boost'},
  {key: 'intake', label: 'Intake air'},
  {key: 'oil', label: 'Oil'},
  {key: 'fuel', label: 'Fuel'},
  {key: 'range', label: 'Range'},
  {key: 'odometer', label: 'Odometer'},
];

/** What the This drive page can list. */
export const DRIVE_STATS: StatOption[] = [
  {key: 'time', label: 'Time'},
  {key: 'distance', label: 'Distance'},
  {key: 'mileage', label: 'Mileage'},
  {key: 'fuelUsed', label: 'Fuel used'},
  {key: 'cost', label: 'Cost'},
  {key: 'avgSpeed', label: 'Avg speed'},
];

/** Whatever was stored, as the known stat keys in list order; nothing valid stored means all of them. */
export const sanitizeStatKeys = (raw: unknown, options: StatOption[]): string[] => {
  if (!Array.isArray(raw)) {
    return options.map((o) => o.key);
  }
  return options.filter((o) => raw.includes(o.key)).map((o) => o.key);
};

export const shows = (chosen: string[], key: string): boolean => chosen.includes(key);
