import type {UnitSystem} from './units';

const MI_PER_KM = 0.621371;

/** "22,121" and "Odometer · km": the car's total distance, as its adapter last read it. */
export const odometerLabel = (km: number, units: UnitSystem): {value: string; label: string} => {
  const imperial = units === 'imperial';
  return {value: Math.round(imperial ? km * MI_PER_KM : km).toLocaleString('en-US'), label: `Odometer · ${imperial ? 'mi' : 'km'}`};
};
