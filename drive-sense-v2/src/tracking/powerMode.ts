import type {PowerMode} from '../stores/preferencesStore';

/** `expo-location` accuracy names, kept as strings so this stays a pure, testable table. */
export type AccuracyName = 'BestForNavigation' | 'High' | 'Balanced';

/** GPS precision against battery (Settings → Power mode). Applies from the next drive. */
export const POWER_MODES: Record<PowerMode, {accuracy: AccuracyName; timeInterval: number; distanceInterval: number; label: string; hint: string}> = {
  maximum: {accuracy: 'BestForNavigation', timeInterval: 1000, distanceInterval: 0, label: 'Maximum', hint: 'Best accuracy: GPS every second. Uses the most battery.'},
  balanced: {accuracy: 'High', timeInterval: 2000, distanceInterval: 5, label: 'Balanced', hint: 'Accurate routes and speeds with less battery. Recommended.'},
  efficient: {accuracy: 'Balanced', timeInterval: 5000, distanceInterval: 15, label: 'Efficient', hint: 'Longest battery life; routes and top speed are less exact.'},
};
