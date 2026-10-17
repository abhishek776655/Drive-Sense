/**
 * Calendar days in the phone's time zone, as `YYYY-MM-DD` keys, the same days the server works
 * out with the `tz` the app sends. Arithmetic runs on day numbers (days since 1970-01-01), so
 * daylight-saving changes never shift a day.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** The local calendar day of an instant. */
export const dayKey = (at: Date | number | string): string => {
  const d = new Date(at);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const parts = (key: string) => key.split('-').map(Number) as [number, number, number];

export const dayNumber = (key: string): number => {
  const [y, m, d] = parts(key);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

export const keyOfDay = (n: number): string => {
  const d = new Date(n * 86_400_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

export const addDays = (key: string, days: number) => keyOfDay(dayNumber(key) + days);

/** Monday 0 … Sunday 6 (1970-01-01 was a Thursday). */
export const weekdayOf = (key: string) => (((dayNumber(key) + 3) % 7) + 7) % 7;

/** Monday of the week holding the day. */
export const mondayOf = (key: string) => addDays(key, -weekdayOf(key));

/** The 1st of the day's month. */
export const monthOf = (key: string) => `${key.slice(0, 7)}-01`;

export const addMonths = (key: string, months: number) => {
  const [y, m] = parts(key);
  const index = y * 12 + (m - 1) + months;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}-01`;
};

/** Local midnight starting the day. */
export const midnightOf = (key: string): Date => {
  const [y, m, d] = parts(key);
  return new Date(y, m - 1, d);
};
