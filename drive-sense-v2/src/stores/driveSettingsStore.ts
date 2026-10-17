import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';
import type {SpeedScale} from '../utils/gaugeMath';

export const GAUGE_STYLES = ['arc', 'classic', 'digital', 'minimal', 'ring', 'retro', 'tape', 'heritage', 'neon'] as const;
export type GaugeStyle = (typeof GAUGE_STYLES)[number];
export type DriveMode = 'map' | 'gauge';

export type StatId =
  | 'distance'
  | 'time'
  | 'avgSpeed'
  | 'topSpeed'
  | 'maxG'
  | 'liveG'
  | 'altitude'
  | 'elevationGain'
  | 'heading'
  | 'events'
  | 'liveScore'
  | 'smoothness'
  | 'accuracy';

export const ALL_STATS: StatId[] = [
  'distance',
  'time',
  'avgSpeed',
  'topSpeed',
  'maxG',
  'liveG',
  'altitude',
  'elevationGain',
  'heading',
  'events',
  'liveScore',
  'smoothness',
  'accuracy',
];

export const MAX_STATS = 6;
/** Map shows the first four; Smoothness is fourth so it is on the map sheet by default. */
export const DEFAULT_STATS: StatId[] = ['distance', 'avgSpeed', 'topSpeed', 'smoothness', 'maxG', 'heading'];

/** Gauge-only accent swatches; the app-wide accent is a later theming feature. */
export const GAUGE_ACCENTS = ['#FF6D00', '#2F7BFF', '#2BD35A', '#C13BF0', '#FF453A', '#25D0C4'];

export interface DriveSettings {
  mode: DriveMode;
  gaugeStyle: GaugeStyle;
  gaugeAccent: string;
  scale: SpeedScale;
  stats: StatId[];
  /** Live map view: tilted 3D facing the direction of travel, or flat north-up. */
  tilt3d: boolean;
  /** Map mode: the compass (with heading and elevation) under the top bar. */
  showCompass: boolean;
  /** Map mode: the car's latitude and longitude in a chip. */
  showCoordinates: boolean;
}

export const DEFAULT_DRIVE_SETTINGS: DriveSettings = {
  mode: 'map',
  gaugeStyle: 'arc',
  gaugeAccent: GAUGE_ACCENTS[0],
  scale: 'auto',
  stats: DEFAULT_STATS,
  tilt3d: true,
  showCompass: true,
  showCoordinates: false,
};

/** Tapping a chosen stat removes it; tapping a new one appends it, ignored once 6 are chosen. */
export const toggleStat = (stats: StatId[], id: StatId): StatId[] => {
  if (stats.includes(id)) {
    return stats.filter((s) => s !== id);
  }
  return stats.length >= MAX_STATS ? stats : [...stats, id];
};

export const moveStat = (stats: StatId[], id: StatId, direction: -1 | 1): StatId[] => {
  const index = stats.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= stats.length) {
    return stats;
  }
  const next = [...stats];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

/** Stored settings from an older build may be partial or hold unknown ids; keep only what is valid. */
export const sanitizeSettings = (raw: unknown): DriveSettings => {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<DriveSettings>;
  const stats = Array.isArray(value.stats)
    ? value.stats.filter((s): s is StatId => ALL_STATS.includes(s as StatId)).slice(0, MAX_STATS)
    : DEFAULT_STATS;
  return {
    mode: value.mode === 'gauge' ? 'gauge' : 'map',
    gaugeStyle: (GAUGE_STYLES as readonly string[]).includes(value.gaugeStyle as string)
      ? (value.gaugeStyle as GaugeStyle)
      : 'arc',
    gaugeAccent: GAUGE_ACCENTS.includes(value.gaugeAccent ?? '') ? (value.gaugeAccent as string) : GAUGE_ACCENTS[0],
    scale: ([120, 200, 300, 'auto'] as SpeedScale[]).includes(value.scale as SpeedScale) ? (value.scale as SpeedScale) : 'auto',
    stats: stats.length > 0 ? stats : DEFAULT_STATS,
    tilt3d: value.tilt3d !== false,
    showCompass: value.showCompass !== false,
    showCoordinates: value.showCoordinates === true,
  };
};

const KEY = 'drive_settings_v1';

interface DriveSettingsState extends DriveSettings {
  hydrate: () => Promise<void>;
  update: (patch: Partial<DriveSettings>) => void;
  toggle: (id: StatId) => void;
  move: (id: StatId, direction: -1 | 1) => void;
}

export const useDriveSettingsStore = create<DriveSettingsState>((set, get) => {
  const persist = () => {
    const {mode, gaugeStyle, gaugeAccent, scale, stats, tilt3d, showCompass, showCoordinates} = get();
    void AsyncStorage.setItem(KEY, JSON.stringify({mode, gaugeStyle, gaugeAccent, scale, stats, tilt3d, showCompass, showCoordinates}));
  };
  return {
    ...DEFAULT_DRIVE_SETTINGS,
    hydrate: async () => {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        try {
          set(sanitizeSettings(JSON.parse(raw)));
        } catch {
          set(DEFAULT_DRIVE_SETTINGS);
        }
      }
    },
    update: (patch) => {
      set(patch);
      persist();
    },
    toggle: (id) => {
      set({stats: toggleStat(get().stats, id)});
      persist();
    },
    move: (id, direction) => {
      set({stats: moveStat(get().stats, id, direction)});
      persist();
    },
  };
});
