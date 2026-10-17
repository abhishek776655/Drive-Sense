import type {Achievement, AchievementCategory, AchievementsOverview} from '../services/achievementsService';
import {distanceUnit, distanceValue, type UnitSystem} from './units';

export const ACHIEVEMENT_CATEGORIES: {value: AchievementCategory | 'all'; label: string}[] = [
  {value: 'all', label: 'All'},
  {value: 'distance', label: 'Distance'},
  {value: 'drives', label: 'Drives'},
  {value: 'time', label: 'Time'},
  {value: 'streak', label: 'Streak'},
  {value: 'night', label: 'Night'},
  {value: 'gforce', label: 'G-Force'},
  {value: 'smooth', label: 'Smooth'},
];

/** Where the user is inside the current level: XP into it, XP it spans, and that as 0..1. */
export const levelProgress = (o: Pick<AchievementsOverview, 'xp' | 'level_start_xp' | 'next_level_xp'>) => {
  if (o.next_level_xp == null) {
    return {into: o.xp - o.level_start_xp, span: 0, fraction: 1};
  }
  const span = o.next_level_xp - o.level_start_xp;
  const into = o.xp - o.level_start_xp;
  return {into, span, fraction: span > 0 ? Math.min(1, Math.max(0, into / span)) : 1};
};

const whole = (n: number) => Math.floor(n).toLocaleString('en-IN');

/** "62 / 100 km", "3 / 7 days", "31 / 50 h", "0.42 / 0.8 G" — distance in the chosen units. */
export const progressLabel = (a: Achievement, units: UnitSystem): string => {
  switch (a.category) {
    case 'distance': {
      const unit = distanceUnit(units);
      return `${whole(distanceValue(a.progress, units) ?? 0)} / ${whole(distanceValue(a.target, units) ?? 0)} ${unit}`;
    }
    case 'time':
      return `${whole(a.progress / 3600)} / ${whole(a.target / 3600)} h`;
    case 'streak':
      return `${whole(a.progress)} / ${whole(a.target)} days`;
    case 'gforce':
      return `${a.progress.toFixed(2)} / ${a.target} G`;
    default:
      return `${whole(a.progress)} / ${whole(a.target)}`;
  }
};

/** Distance achievements read in the chosen units: "Drive a total of 100 km" → "… 62 mi". */
export const achievementDescription = (a: Achievement, units: UnitSystem): string => {
  if (a.category !== 'distance' || units === 'metric') {
    return a.description;
  }
  return `Drive a total of ${whole(distanceValue(a.target, units) ?? 0)} ${distanceUnit(units)}`;
};

/** Newest unlocks first, then locked ones by how close they are. */
export const sortAchievements = (list: Achievement[]) => ({
  unlocked: list.filter((a) => a.unlocked_at).sort((x, y) => (y.unlocked_at ?? '').localeCompare(x.unlocked_at ?? '')),
  locked: list.filter((a) => !a.unlocked_at).sort((x, y) => y.progress / y.target - x.progress / x.target),
});
