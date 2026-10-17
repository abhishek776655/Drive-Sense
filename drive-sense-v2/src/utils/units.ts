import {DASH, formatInt} from './format';

export type UnitSystem = 'metric' | 'imperial';
export type TemperatureUnit = 'c' | 'f';

const METERS_PER_MILE = 1609.344;
const KMH_PER_MPH = 1.609344;

const isNum = (n: number | null | undefined): n is number => n != null && Number.isFinite(n);

/** km/h or mph. */
export const speedValue = (mps: number | null | undefined, units: UnitSystem): number | null =>
  isNum(mps) ? (units === 'imperial' ? (mps * 3.6) / KMH_PER_MPH : mps * 3.6) : null;

/** km or miles. */
export const distanceValue = (meters: number | null | undefined, units: UnitSystem): number | null =>
  isNum(meters) ? (units === 'imperial' ? meters / METERS_PER_MILE : meters / 1000) : null;

export const formatSpeed = (mps: number | null | undefined, units: UnitSystem): string => formatInt(speedValue(mps, units));

/** Same shape as `formatKm`: one decimal under 100, whole numbers from 100. */
export const formatDistance = (meters: number | null | undefined, units: UnitSystem): string => {
  const value = distanceValue(meters, units);
  if (value == null) {
    return DASH;
  }
  return value >= 100 ? String(Math.round(value)) : value.toFixed(1);
};

export const speedUnit = (units: UnitSystem) => (units === 'imperial' ? 'mph' : 'km/h');
export const distanceUnit = (units: UnitSystem) => (units === 'imperial' ? 'mi' : 'km');

/** A km/h setting (the speed alert is stored in km/h) shown in the chosen unit, rounded. */
export const kmhInUnits = (kmh: number, units: UnitSystem): number => Math.round(units === 'imperial' ? kmh / KMH_PER_MPH : kmh);

export const formatTemperature = (celsius: number | null | undefined, unit: TemperatureUnit): string =>
  isNum(celsius) ? `${Math.round(unit === 'f' ? (celsius * 9) / 5 + 32 : celsius)}°` : DASH;
