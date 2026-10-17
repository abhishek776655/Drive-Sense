import {useMemo} from 'react';
import {usePreferencesStore} from '../stores/preferencesStore';
import {distanceUnit, distanceValue, formatDistance, formatSpeed, formatTemperature, speedUnit, speedValue} from '../utils/units';

/**
 * Speed and distance in the units chosen in Settings. Components call this (rather than reading a
 * global) so they re-render when the setting changes.
 */
export function useUnits() {
  const units = usePreferencesStore((s) => s.units);
  const temperature = usePreferencesStore((s) => s.temperature);
  return useMemo(
    () => ({
      units,
      speed: (mps: number | null | undefined) => formatSpeed(mps, units),
      distance: (meters: number | null | undefined) => formatDistance(meters, units),
      speedValue: (mps: number | null | undefined) => speedValue(mps, units),
      distanceValue: (meters: number | null | undefined) => distanceValue(meters, units),
      temperature: (celsius: number | null | undefined) => formatTemperature(celsius, temperature),
      speedUnit: speedUnit(units),
      distanceUnit: distanceUnit(units),
    }),
    [units, temperature],
  );
}
