/** A local calendar day as `YYYY-MM-DD` (what the stats API takes), never via UTC. */
export const isoDay = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const parseDay = (iso: string): Date => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

export interface DayRange {
  start: string;
  end: string;
}

/** The month as weeks of seven, Monday first; days outside the month are null. */
export const monthWeeks = (year: number, month: number): (Date | null)[][] => {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const cells: (Date | null)[] = [...Array(lead).fill(null), ...Array.from({length: days}, (_, i) => new Date(year, month, i + 1))];
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return Array.from({length: cells.length / 7}, (_, w) => cells.slice(w * 7, w * 7 + 7));
};

export const monthRange = (year: number, month: number): DayRange => ({
  start: isoDay(new Date(year, month, 1)),
  end: isoDay(new Date(year, month + 1, 0)),
});

const isWholeMonth = ({start, end}: DayRange) => {
  const s = parseDay(start);
  return s.getDate() === 1 && monthRange(s.getFullYear(), s.getMonth()).end === end;
};

/** "Oct 2026" for a whole month, else "3–17 Oct", "28 Sep – 3 Oct" or with years when they differ. */
export const rangeLabel = (range: DayRange): string => {
  const s = parseDay(range.start);
  const e = parseDay(range.end);
  if (isWholeMonth(range)) {
    return s.toLocaleDateString('en-IN', {month: 'short', year: 'numeric'});
  }
  if (range.start === range.end) {
    return s.toLocaleDateString('en-IN', {day: 'numeric', month: 'short'});
  }
  const month = (d: Date) => d.toLocaleDateString('en-IN', {month: 'short'});
  if (s.getFullYear() !== e.getFullYear()) {
    const full = (d: Date) => d.toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'});
    return `${full(s)} – ${full(e)}`;
  }
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()}–${e.getDate()} ${month(s)}`;
  }
  return `${s.getDate()} ${month(s)} – ${e.getDate()} ${month(e)}`;
};

/**
 * Tapping a day in the range calendar: the first tap starts a range, the second ends it (a day
 * before the start starts over), and a tap once both are set starts a new range.
 */
export const pickDay = (current: {start: string | null; end: string | null}, day: string): {start: string; end: string | null} => {
  if (!current.start || current.end || day < current.start) {
    return {start: day, end: null};
  }
  return {start: current.start, end: day};
};
