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

export const temperature = (c: number, unit: TemperatureUnit) => ({value: String(Math.round(unit === 'f' ? (c * 9) / 5 + 32 : c)), unit: unit === 'f' ? '°F' : '°C'});

export const fuelFlow = (lph: number, units: UnitSystem) =>
  units === 'imperial' ? {value: fixed(lph / L_PER_US_GAL, 2), unit: 'gal/h'} : {value: fixed(lph, 1), unit: 'L/h'};

export const economy = (l100: number, units: UnitSystem) =>
  units === 'imperial' ? {value: fixed(MPG_US_FROM_L100 / l100, 1), unit: 'mpg'} : {value: fixed(l100, 1), unit: 'L/100 km'};

export const fuelVolume = (litres: number, units: UnitSystem) =>
  units === 'imperial' ? {value: fixed(litres / L_PER_US_GAL, 2), unit: 'gal'} : {value: fixed(litres, litres < 10 ? 2 : 1), unit: 'L'};

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
  opts: {units: UnitSystem; temperature: TemperatureUnit; engineRunning: boolean},
): ObdTile[] => {
  const tiles: ObdTile[] = [];
  const v = (k: PidKey) => values[k]?.v;
  const coolant = v('coolant');
  if (coolant != null) {
    tiles.push({
      id: 'coolant',
      label: 'Coolant',
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
  if (derived.fuelFlow != null) {
    tiles.push({id: 'fuelFlow', label: 'Fuel flow', ...fuelFlow(derived.fuelFlow, opts.units), icon: 'water', tone: 'normal'});
  }
  if (derived.economy != null) {
    tiles.push({id: 'economy', label: 'Economy now', ...economy(derived.economy, opts.units), icon: 'leaf', tone: 'normal'});
  }
  const voltage = v('voltage');
  if (voltage != null) {
    const low = voltage < (opts.engineRunning ? VOLTAGE_LOW_RUNNING : VOLTAGE_LOW_OFF);
    tiles.push({id: 'voltage', label: 'Battery', value: fixed(voltage, 1), unit: 'V', icon: 'battery-half', tone: low ? 'warn' : 'normal'});
  }
  const fuelLevel = v('fuelLevel');
  if (fuelLevel != null) {
    tiles.push({id: 'fuelLevel', label: 'Fuel level', value: String(Math.round(fuelLevel)), unit: '%', icon: 'color-fill', tone: fuelLevel < 10 ? 'warn' : 'normal'});
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
  return tiles;
};
