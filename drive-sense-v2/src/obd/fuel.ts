import type {UnitSystem} from '../utils/units';
import {carTotals, type CarDrive} from '../stats/carStats';

/**
 * Fuel money and range (spec 2026-10-25, telemetry sources, section 2). Prices are kept per litre
 * and shown per litre or per US gallon with the unit setting.
 */

export const CURRENCIES = ['₹', '$', '€', '£'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const L_PER_US_GAL = 3.785411784;
/** Economy for range comes from this many recent days of driving, when there are any. */
export const RANGE_ECONOMY_DAYS = 30;

/** What the fuel used cost at the given price per litre; null without a price or fuel figure. */
export const fuelCost = (litres: number | null | undefined, pricePerLitre: number | null): number | null =>
  litres == null || pricePerLitre == null ? null : litres * pricePerLitre;

/** "₹42.30", "$3.80", "₹1,240": two decimals below 100, whole numbers above. */
export const formatMoney = (amount: number, currency: Currency): string => {
  const digits = amount < 100 ? 2 : 0;
  return `${currency}${amount.toLocaleString('en-US', {minimumFractionDigits: digits, maximumFractionDigits: digits})}`;
};

/** The stored per-litre price in the unit the user sees (per litre or per US gallon). */
export const priceInUnits = (pricePerLitre: number, units: UnitSystem): number => (units === 'imperial' ? pricePerLitre * L_PER_US_GAL : pricePerLitre);

/** A price typed in the user's unit, back to per litre. */
export const pricePerLitreFrom = (typed: number, units: UnitSystem): number => (units === 'imperial' ? typed / L_PER_US_GAL : typed);

export const priceUnit = (units: UnitSystem) => (units === 'imperial' ? 'gal' : 'L');

/** Kilometres left: fuel level % of the tank at the given economy. Null when any piece is missing. */
export const rangeKm = (fuelLevelPct: number | null | undefined, tankLitres: number | null | undefined, l100km: number | null | undefined): number | null => {
  if (fuelLevelPct == null || tankLitres == null || l100km == null || l100km <= 0) {
    return null;
  }
  return ((fuelLevelPct / 100) * tankLitres) / (l100km / 100);
};

/**
 * Economy to work range out with: this vehicle's last 30 days with car data, else all its drives.
 * Says which, so the card can label it honestly.
 */
export const rangeEconomy = (drives: CarDrive[], vehicleId: string, now = Date.now()): {l100km: number; window: 'last30' | 'all'} | null => {
  const mine = drives.filter((d) => d.vehicleId === vehicleId);
  const recent = carTotals(mine.filter((d) => now - d.startMs <= RANGE_ECONOMY_DAYS * 86_400_000))?.avgL100km;
  if (recent != null) {
    return {l100km: recent, window: 'last30'};
  }
  const all = carTotals(mine)?.avgL100km;
  return all != null ? {l100km: all, window: 'all'} : null;
};
