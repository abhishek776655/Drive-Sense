import type {Ionicons} from '@expo/vector-icons';
import type {ObdDerived} from '../stores/obdStore';
import type {TemperatureUnit, UnitSystem} from '../utils/units';
import type {PidKey} from './pids';

type IconName = keyof typeof Ionicons.glyphMap;

/** normal, or a value worth a look (amber) or acting on (red). */
export type TileTone = 'normal' | 'warn' | 'alert';

export interface ObdTile {
  id: string;
  label: string;
  value: string;
  unit: string;
  icon: IconName;
  tone: TileTone;
}

const L_PER_US_GAL = 3.785411784;
const MPG_US_FROM_L100 = 235.214583;

export const COOLANT_WARN_C = 105;
export const COOLANT_ALERT_C = 115;
/** Battery voltage worth a look: low with the engine off, or not charging with it running. */
export const VOLTAGE_LOW_OFF = 12.0;
export const VOLTAGE_LOW_RUNNING = 13.2;

const fixed = (n: number, places: number) => n.toFixed(places);
const MI_PER_KM = 0.621371;
/** "22,120.8": thousands separated, one decimal. */
const oneDecimal = (n: number) => n.toLocaleString('en-US', {minimumFractionDigits: 1, maximumFractionDigits: 1});

export const temperature = (c: number, unit: TemperatureUnit) => ({value: String(Math.round(unit === 'f' ? (c * 9) / 5 + 32 : c)), unit: unit === 'f' ? '°F' : '°C'});

export type MileageUnit = 'kmpl' | 'l100';

/** Fuel economy in the chosen unit: km/L ("mileage") or L/100 km in metric, mpg in imperial. */
export const economy = (l100: number, units: UnitSystem, mileage: MileageUnit = 'l100') => {
  if (units === 'imperial') {
    return {value: fixed(MPG_US_FROM_L100 / l100, 1), unit: 'mpg'};
  }
  return mileage === 'kmpl' ? {value: fixed(100 / l100, 1), unit: 'km/L'} : {value: fixed(l100, 1), unit: 'L/100 km'};
};

/** "Mileage" where it's read as distance per fuel (km/L, mpg); "Economy" for L/100 km. */
export const economyLabel = (units: UnitSystem, mileage: MileageUnit) => (units === 'metric' && mileage === 'l100' ? 'Economy' : 'Mileage');

/** Under a litre (or a tenth of a gallon) the small unit reads better: "6 mL", not "0.01 L". */
export const fuelVolume = (litres: number, units: UnitSystem) => {
  if (units === 'imperial') {
    const gallons = litres / L_PER_US_GAL;
    return gallons < 0.1 ? {value: fixed(gallons * 128, 1), unit: 'fl oz'} : {value: fixed(gallons, 2), unit: 'gal'};
  }
  return litres < 1 ? {value: String(Math.round(litres * 1000)), unit: 'mL'} : {value: fixed(litres, litres < 10 ? 2 : 1), unit: 'L'};
};

/** Torque in Nm, or lb-ft in imperial. */
export const torqueUnits = (nm: number, units: UnitSystem) => (units === 'imperial' ? {value: String(Math.round(nm * 0.737562)), unit: 'lb-ft'} : {value: String(Math.round(nm)), unit: 'Nm'});

/** Power in kW, or hp in imperial. */
export const powerUnits = (kw: number, units: UnitSystem) => (units === 'imperial' ? {value: String(Math.round(kw * 1.341022)), unit: 'hp'} : {value: String(Math.round(kw)), unit: 'kW'});

/** Boost in kPa (metric) or psi. */
export const pressure = (kpa: number, units: UnitSystem) => (units === 'imperial' ? {value: fixed(kpa * 0.145038, 1), unit: 'psi'} : {value: String(Math.round(kpa)), unit: 'kPa'});

export const gearLabel = (gear: number | null): string | null => (gear == null ? null : gear === 0 ? 'N' : String(gear));

/**
 * The live tiles, in display order, for what the car actually reports (spec 2026-10-25, telemetry,
 * section 2): a value the car never sent has no tile at all.
 */
export const obdTiles = (
  values: Partial<Record<PidKey, {v: number}>>,
  derived: ObdDerived,
  opts: {
    units: UnitSystem;
    temperature: TemperatureUnit;
    engineRunning: boolean;
    rangeKm?: number | null;
    mileage?: MileageUnit;
    driveL100km?: number | null;
    /** This vehicle since midnight, saved drives plus the live one. */
    todayL100km?: number | null;
    todayFuelL?: number | null;
    /** For fuel remaining in litres; none, none shown. */
    tankLitres?: number | null;
  },
): ObdTile[] => {
  const tiles: ObdTile[] = [];
  const v = (k: PidKey) => values[k]?.v;
  const coolant = v('coolant');
  if (coolant != null) {
    tiles.push({
      id: 'coolant',
      // Coolant temperature is what a dashboard's engine temperature gauge shows.
      label: 'Engine temp',
      ...temperature(coolant, opts.temperature),
      icon: 'thermometer',
      tone: coolant >= COOLANT_ALERT_C ? 'alert' : coolant >= COOLANT_WARN_C ? 'warn' : 'normal',
    });
  }
  const load = v('load');
  if (load != null) {
    tiles.push({id: 'load', label: 'Engine load', value: String(Math.round(load)), unit: '%', icon: 'barbell', tone: 'normal'});
  }
  const throttle = v('throttle');
  if (throttle != null) {
    tiles.push({id: 'throttle', label: 'Throttle', value: String(Math.round(throttle)), unit: '%', icon: 'speedometer', tone: 'normal'});
  }
  if (derived.torqueNm != null) {
    tiles.push({id: 'torque', label: 'Torque', ...torqueUnits(derived.torqueNm, opts.units), icon: 'sync', tone: 'normal'});
  }
  if (derived.powerKw != null) {
    tiles.push({id: 'power', label: 'Power', ...powerUnits(derived.powerKw, opts.units), icon: 'flash', tone: 'normal'});
  }
  if (derived.accelMps2 != null) {
    const a = derived.accelMps2;
    tiles.push({id: 'accel', label: 'Acceleration', value: `${a < 0 ? '−' : ''}${Math.abs(a).toFixed(1)}`, unit: 'm/s²', icon: 'trending-up', tone: 'normal'});
  }
  if (derived.economy != null) {
    tiles.push({id: 'economy', label: `${economyLabel(opts.units, opts.mileage ?? 'l100')} now`, ...economy(derived.economy, opts.units, opts.mileage), icon: 'leaf', tone: 'normal'});
  }
  if (opts.driveL100km != null) {
    tiles.push({id: 'driveEconomy', label: `${economyLabel(opts.units, opts.mileage ?? 'l100')} this drive`, ...economy(opts.driveL100km, opts.units, opts.mileage), icon: 'speedometer', tone: 'normal'});
  }
  if (opts.todayL100km != null) {
    tiles.push({id: 'todayEconomy', label: `${economyLabel(opts.units, opts.mileage ?? 'l100')} today`, ...economy(opts.todayL100km, opts.units, opts.mileage), icon: 'calendar', tone: 'normal'});
  }
  if (opts.todayFuelL != null) {
    tiles.push({id: 'todayFuel', label: 'Fuel today', ...fuelVolume(opts.todayFuelL, opts.units), icon: 'water', tone: 'normal'});
  }
  const voltage = v('voltage');
  if (voltage != null) {
    const low = voltage < (opts.engineRunning ? VOLTAGE_LOW_RUNNING : VOLTAGE_LOW_OFF);
    tiles.push({id: 'voltage', label: 'Battery', value: fixed(voltage, 1), unit: 'V', icon: 'battery-half', tone: low ? 'warn' : 'normal'});
  }
  const fuelLevel = v('fuelLevel');
  if (fuelLevel != null) {
    // The car only reports a percentage: litres need the tank size, never a guessed one.
    const litres = opts.tankLitres != null ? (fuelLevel / 100) * opts.tankLitres : null;
    const left = litres == null ? '' : opts.units === 'imperial' ? ` · ${fixed(litres / L_PER_US_GAL, 1)} gal` : ` · ${fixed(litres, 1)} L`;
    tiles.push({id: 'fuelLevel', label: 'Fuel remaining', value: String(Math.round(fuelLevel)), unit: `%${left}`, icon: 'color-fill', tone: fuelLevel < 10 ? 'warn' : 'normal'});
  }
  if (opts.rangeKm != null) {
    const miles = opts.units === 'imperial';
    tiles.push({id: 'range', label: 'Range', value: `≈${Math.round(miles ? opts.rangeKm / 1.609344 : opts.rangeKm)}`, unit: miles ? 'mi' : 'km', icon: 'navigate', tone: opts.rangeKm < 50 ? 'warn' : 'normal'});
  }
  const intake = v('intakeTemp');
  if (intake != null) {
    tiles.push({id: 'intakeTemp', label: 'Intake air', ...temperature(intake, opts.temperature), icon: 'cloud', tone: 'normal'});
  }
  if (derived.boost != null) {
    tiles.push({id: 'boost', label: 'Boost', ...pressure(derived.boost, opts.units), icon: 'flash', tone: 'normal'});
  }
  const oil = v('oilTemp');
  if (oil != null) {
    tiles.push({id: 'oilTemp', label: 'Oil', ...temperature(oil, opts.temperature), icon: 'flame', tone: oil >= 130 ? 'warn' : 'normal'});
  }
  const ambient = v('ambient');
  if (ambient != null) {
    tiles.push({id: 'ambient', label: 'Outside', ...temperature(ambient, opts.temperature), icon: 'partly-sunny', tone: 'normal'});
  }
  const odo = v('odometer');
  if (odo != null) {
    const imperial = opts.units === 'imperial';
    tiles.push({id: 'odometer', label: 'Odometer', value: oneDecimal(imperial ? odo * MI_PER_KM : odo), unit: imperial ? 'mi' : 'km', icon: 'speedometer-outline', tone: 'normal'});
  }
  return tiles;
};
