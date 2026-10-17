import {addDays, dayNumber, mondayOf} from './days';

/**
 * `compute_streak`: consecutive days with a drive, ending today or yesterday (a streak survives
 * until the end of the day after the last drive).
 */
export const dayStreak = (days: Iterable<string>, today: string): number => {
  const set = new Set(days);
  let cursor = set.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
};

/** `compute_week_streak`: consecutive Monday-start weeks with a drive, ending this week or last. */
export const weekStreak = (days: Iterable<string>, today: string): number => {
  const weeks = new Set([...days].map(mondayOf));
  const thisWeek = mondayOf(today);
  let cursor = weeks.has(thisWeek) ? thisWeek : addDays(thisWeek, -7);
  let streak = 0;
  while (weeks.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -7);
  }
  return streak;
};

/** `best_streak`: the longest run of consecutive days with a drive. */
export const bestStreak = (days: Iterable<string>): number => {
  const sorted = [...new Set(days)].map(dayNumber).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let previous: number | null = null;
  for (const day of sorted) {
    run = previous != null && day - previous === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
};
