import type {TripSort, TripSummary} from '../services/tripService';

export type Period = 'week' | 'month' | 'last30' | 'year' | 'all';

export const PERIODS: {value: Period; label: string; empty: string}[] = [
  {value: 'week', label: 'This week', empty: 'No drives this week'},
  {value: 'month', label: 'This month', empty: 'No drives this month'},
  {value: 'last30', label: 'Last 30 days', empty: 'No drives in the last 30 days'},
  {value: 'year', label: 'This year', empty: 'No drives this year'},
  {value: 'all', label: 'All time', empty: 'No drives yet'},
];

export const SORTS: {value: TripSort; label: string}[] = [
  {value: 'newest', label: 'Newest first'},
  {value: 'oldest', label: 'Oldest first'},
  {value: 'longest', label: 'Longest'},
  {value: 'fastest', label: 'Fastest'},
  {value: 'best', label: 'Best score'},
  {value: 'worst', label: 'Worst score'},
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Local start of the period (weeks start on Monday); null for all time. */
export const periodRange = (period: Period, now: Date = new Date()): Date | null => {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  switch (period) {
    case 'week':
      return new Date(y, m, d - ((now.getDay() + 6) % 7));
    case 'month':
      return new Date(y, m, 1);
    case 'last30':
      return new Date(y, m, d - 30);
    case 'year':
      return new Date(y, 0, 1);
    default:
      return null;
  }
};

export interface MonthGroup {
  key: string;
  title: string;
  items: TripSummary[];
  distanceM: number;
  durationS: number;
  topMps: number | null;
}

/** Consecutive trips in the same local month, in the order given, with month totals. */
export const groupByMonth = (items: TripSummary[]): MonthGroup[] => {
  const groups: MonthGroup[] = [];
  for (const item of items) {
    const at = new Date(item.start_time);
    const key = `${at.getFullYear()}-${at.getMonth()}`;
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      group = {key, title: `${MONTHS[at.getMonth()]} ${at.getFullYear()}`, items: [], distanceM: 0, durationS: 0, topMps: null};
      groups.push(group);
    }
    group.items.push(item);
    group.distanceM += item.distance_meters;
    group.durationS += item.duration_seconds;
    if (item.max_speed_mps != null) {
      group.topMps = Math.max(group.topMps ?? 0, item.max_speed_mps);
    }
  }
  return groups;
};

/** Card title, as in Rovy: the city the drive ended in (last part of the address), else where it started, else "Drive". */
export const tripTitle = ({start_address, end_address}: {start_address: string | null; end_address: string | null}): string =>
  (end_address ?? start_address)?.split(',').pop()?.trim() || 'Drive';
