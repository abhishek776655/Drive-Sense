import type {UnitSystem} from './units';

const MI_PER_KM = 0.621371;
const DAY_MS = 86_400_000;

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** "22,121" and "km · today": the adapter's last odometer reading and how old it is. */
export const odometerLabel = (km: number, readAt: string, units: UnitSystem, now = Date.now()): {value: string; label: string} => {
  const imperial = units === 'imperial';
  const days = Math.round((startOfDay(now) - startOfDay(Date.parse(readAt))) / DAY_MS);
  const when = days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
  return {value: Math.round(imperial ? km * MI_PER_KM : km).toLocaleString('en-US'), label: `${imperial ? 'mi' : 'km'} · ${when}`};
};
