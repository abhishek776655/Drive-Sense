import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';
import type {TemperatureUnit, UnitSystem} from '../utils/units';

export type MapStyle = 'standard' | 'muted' | 'satellite' | 'hybrid';
export type PowerMode = 'maximum' | 'balanced' | 'efficient';
/** Where drives are kept (local-first part 3): synced to the account, or never leaving this phone. */
export type DriveBackup = 'cloud' | 'phone';

export interface Preferences {
  units: UnitSystem;
  temperature: TemperatureUnit;
  mapStyle: MapStyle;
  autoStart: boolean;
  autoStop: boolean;
  autoStopMinutes: number;
  /** Pause the drive on its own after standing still this long, and resume on driving off. */
  autoPause: boolean;
  autoPauseSeconds: number;
  ignoreShortDrives: boolean;
  speedAlert: boolean;
  /** Stored in km/h whatever the units; shown in the chosen unit. */
  speedAlertKmh: number;
  powerMode: PowerMode;
  /** Drive-saved and forgotten-drive notifications (they still need the system permission). */
  notifications: boolean;
  driveBackup: DriveBackup;
}

export const AUTO_STOP_MINUTES = [1, 3, 5, 10];
export const AUTO_PAUSE_SECONDS = [30, 60, 120, 300];
export const SPEED_ALERT_MIN_KMH = 40;
export const SPEED_ALERT_MAX_KMH = 150;
export const SPEED_ALERT_STEP_KMH = 10;

export const DEFAULT_PREFERENCES: Preferences = {
  units: 'metric',
  temperature: 'c',
  // Apple's standard map: in dark mode the blue-slate look Rovy uses (muted reads teal-green).
  mapStyle: 'standard',
  autoStart: true,
  autoStop: true,
  autoStopMinutes: 3,
  autoPause: false,
  autoPauseSeconds: 60,
  ignoreShortDrives: false,
  speedAlert: false,
  speedAlertKmh: 100,
  powerMode: 'balanced',
  notifications: true,
  driveBackup: 'cloud',
};

const KEY = 'preferences_v1';

const oneOf = <T>(value: unknown, options: readonly T[], fallback: T): T => (options.includes(value as T) ? (value as T) : fallback);
const bool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

/** Whatever was stored, as valid preferences: unknown or missing values take their default. */
export const sanitizePreferences = (raw: unknown): Preferences => {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_PREFERENCES;
  const alert = typeof r.speedAlertKmh === 'number' ? Math.round(r.speedAlertKmh / SPEED_ALERT_STEP_KMH) * SPEED_ALERT_STEP_KMH : d.speedAlertKmh;
  return {
    units: oneOf(r.units, ['metric', 'imperial'] as const, d.units),
    temperature: oneOf(r.temperature, ['c', 'f'] as const, d.temperature),
    mapStyle: oneOf(r.mapStyle, ['standard', 'muted', 'satellite', 'hybrid'] as const, d.mapStyle),
    autoStart: bool(r.autoStart, d.autoStart),
    autoStop: bool(r.autoStop, d.autoStop),
    autoStopMinutes: oneOf(r.autoStopMinutes, AUTO_STOP_MINUTES, d.autoStopMinutes),
    autoPause: bool(r.autoPause, d.autoPause),
    autoPauseSeconds: oneOf(r.autoPauseSeconds, AUTO_PAUSE_SECONDS, d.autoPauseSeconds),
    ignoreShortDrives: bool(r.ignoreShortDrives, d.ignoreShortDrives),
    speedAlert: bool(r.speedAlert, d.speedAlert),
    speedAlertKmh: Math.min(SPEED_ALERT_MAX_KMH, Math.max(SPEED_ALERT_MIN_KMH, alert)),
    powerMode: oneOf(r.powerMode, ['maximum', 'balanced', 'efficient'] as const, d.powerMode),
    notifications: bool(r.notifications, d.notifications),
    driveBackup: oneOf(r.driveBackup, ['cloud', 'phone'] as const, d.driveBackup),
  };
};

interface PreferencesState extends Preferences {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  set: (patch: Partial<Preferences>) => Promise<void>;
}

const pick = (state: Preferences): Preferences => sanitizePreferences(state);

/** Device-only settings (Settings sheet), saved to AsyncStorage as one JSON value. */
export const usePreferencesStore = create<PreferencesState>((setState, get) => ({
  ...DEFAULT_PREFERENCES,
  hydrated: false,
  hydrate: async () => {
    let stored: unknown = null;
    try {
      const text = await AsyncStorage.getItem(KEY);
      stored = text ? JSON.parse(text) : null;
    } catch {
      stored = null;
    }
    setState({...sanitizePreferences(stored), hydrated: true});
  },
  set: async (patch) => {
    const next = sanitizePreferences({...pick(get()), ...patch});
    setState(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  },
}));
