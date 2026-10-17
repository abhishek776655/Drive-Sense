import type {Achievement, AchievementCategory, AchievementsOverview} from '../services/achievementsService';
import {addDays, dayKey, dayNumber, mondayOf} from './days';
import type {TripFacts} from './facts';

/** Mirrors `achievement_service` (spec 2026-10-17, local-first part 2c): nothing is stored. */
const KM = 1000;
const HOUR = 3600;
export const NIGHT_START_HOUR = 20;
export const NIGHT_END_HOUR = 5;
export const SMOOTH_SCORE = 90;
/** A drive this short says nothing about smooth driving. */
export const CLEAN_MIN_METERS = 1000;

type Entry = {id: string; category: AchievementCategory; title: string; description: string; target: number; xp: number};
const a = (id: string, category: AchievementCategory, title: string, description: string, target: number, xp: number): Entry => ({id, category, title, description, target, xp});

export const CATALOG: Entry[] = [
  a('distance_10', 'distance', 'First Miles', 'Drive a total of 10 km', 10 * KM, 50),
  a('distance_50', 'distance', 'Getting Rolling', 'Drive a total of 50 km', 50 * KM, 75),
  a('distance_100', 'distance', 'Century Club', 'Drive a total of 100 km', 100 * KM, 100),
  a('distance_250', 'distance', 'Road Tripper', 'Drive a total of 250 km', 250 * KM, 150),
  a('distance_500', 'distance', 'Explorer', 'Drive a total of 500 km', 500 * KM, 200),
  a('distance_1000', 'distance', 'Thousand Club', 'Drive a total of 1,000 km', 1000 * KM, 300),
  a('distance_2500', 'distance', 'Long Hauler', 'Drive a total of 2,500 km', 2500 * KM, 400),
  a('distance_5000', 'distance', 'Road Warrior', 'Drive a total of 5,000 km', 5000 * KM, 500),
  a('drives_1', 'drives', 'First Drive', 'Complete your first drive', 1, 25),
  a('drives_5', 'drives', 'Warming Up', 'Complete 5 drives', 5, 50),
  a('drives_10', 'drives', 'Regular Driver', 'Complete 10 drives', 10, 75),
  a('drives_20', 'drives', 'Dedicated', 'Complete 20 drives', 20, 100),
  a('drives_50', 'drives', 'Behind the Wheel', 'Complete 50 drives', 50, 200),
  a('drives_100', 'drives', 'Centurion', 'Complete 100 drives', 100, 300),
  a('drives_200', 'drives', 'Veteran', 'Complete 200 drives', 200, 400),
  a('drives_500', 'drives', 'Five Hundred Club', 'Complete 500 drives', 500, 500),
  a('time_1', 'time', 'First Hour', 'Drive for a total of 1 hour', 1 * HOUR, 50),
  a('time_5', 'time', 'Road Time', 'Drive for a total of 5 hours', 5 * HOUR, 100),
  a('time_10', 'time', 'Seasoned Driver', 'Drive for a total of 10 hours', 10 * HOUR, 150),
  a('time_25', 'time', 'Time Traveler', 'Drive for a total of 25 hours', 25 * HOUR, 250),
  a('time_50', 'time', 'Iron Seat', 'Drive for a total of 50 hours', 50 * HOUR, 400),
  a('streak_3', 'streak', 'Three-Peat', 'Drive 3 days in a row', 3, 75),
  a('streak_7', 'streak', 'Weekly Warrior', 'Drive 7 days in a row', 7, 150),
  a('streak_14', 'streak', 'Fortnight Force', 'Drive 14 days in a row', 14, 250),
  a('streak_30', 'streak', 'Monthly Master', 'Drive 30 days in a row', 30, 500),
  a('goal_1', 'streak', 'Goal Getter', 'Reach your weekly drive goal', 1, 75),
  a('goal_4', 'streak', 'On a Roll', 'Reach your weekly goal 4 weeks in a row', 4, 250),
  a('night_1', 'night', 'Night Owl', 'Complete 1 night drive', 1, 50),
  a('night_5', 'night', 'Midnight Cruiser', 'Complete 5 night drives', 5, 100),
  a('night_10', 'night', 'Creature of the Night', 'Complete 10 night drives', 10, 150),
  a('night_25', 'night', 'Nocturnal', 'Complete 25 night drives', 25, 300),
  a('gforce_05', 'gforce', 'Feeling the Force', 'Experience 0.5 G', 0.5, 50),
  a('gforce_08', 'gforce', "Pulling G's", 'Experience 0.8 G', 0.8, 100),
  a('smooth_1', 'smooth', 'Smooth Operator', 'Score 90+ on a drive', 1, 50),
  a('smooth_5', 'smooth', 'Steady Hands', 'Score 90+ on 5 drives', 5, 100),
  a('smooth_25', 'smooth', 'Silk Road', 'Score 90+ on 25 drives', 25, 200),
  a('smooth_50', 'smooth', 'Zen Driver', 'Score 90+ on 50 drives', 50, 300),
  a('clean_10', 'smooth', 'Clean Sheet', '10 drives with no harsh braking or acceleration', 10, 150),
];

/** Cumulative XP needed to reach each level (level 1 starts at 0); each level needs 50 more. */
const LEVEL_XP = [0];
for (let step = 100; step < 100 + 50 * 40; step += 50) {
  LEVEL_XP.push(LEVEL_XP[LEVEL_XP.length - 1] + step);
}

const TITLES: [number, string][] = [
  [14, 'Road Legend'],
  [11, 'Highway Hero'],
  [8, 'Road Captain'],
  [5, 'Cruiser'],
  [3, 'Commuter'],
  [2, 'Rookie'],
  [1, 'Learner'],
];

/** [level, title, XP where it starts, XP where the next starts (null at the top)]. */
export const levelFor = (xp: number): [number, string, number, number | null] => {
  const level = LEVEL_XP.reduce((best, need, i) => (xp >= need ? i + 1 : best), 1);
  const title = TITLES.find(([floor]) => level >= floor)![1];
  return [level, title, LEVEL_XP[level - 1], level < LEVEL_XP.length ? LEVEL_XP[level] : null];
};

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const isNight = (start: Date) => start.getHours() >= NIGHT_START_HOUR || start.getHours() < NIGHT_END_HOUR;

type Totals = Record<'distance' | 'drives' | 'time' | 'night' | 'gforce' | 'smooth' | 'clean' | 'streak' | 'goal_weeks' | 'goal_run', number>;

const keyOf = (entry: Entry): keyof Totals => {
  if (entry.id.startsWith('clean')) {
    return 'clean';
  }
  if (entry.id === 'goal_1') {
    return 'goal_weeks';
  }
  if (entry.id === 'goal_4') {
    return 'goal_run';
  }
  return entry.category;
};

/**
 * `compute_achievements`: walks the drives oldest first; each achievement unlocks at the drive
 * whose running total first reaches its target. `weeklyGoal` drives the goal achievements.
 */
export function computeAchievements(drives: TripFacts[], weeklyGoal: number | null = null): Achievement[] {
  // Drives starting together keep a fixed order (the server's is whatever the database returns).
  const ordered = [...drives].sort((x, y) => x.startMs - y.startMs || byText(x.id, y.id));
  const totals: Totals = {distance: 0, drives: 0, time: 0, night: 0, gforce: 0, smooth: 0, clean: 0, streak: 0, goal_weeks: 0, goal_run: 0};
  const weekDrives = new Map<string, number>();
  const goalRuns = new Map<string, number>();
  const unlocked = new Map<string, TripFacts>();
  let streak = 0;
  let lastDay: string | null = null;

  for (const drive of ordered) {
    const start = new Date(drive.startMs);
    const day = dayKey(start);
    if (day !== lastDay) {
      streak = lastDay != null && dayNumber(day) - dayNumber(lastDay) === 1 ? streak + 1 : 1;
      lastDay = day;
    }
    totals.distance += drive.distance;
    totals.drives += 1;
    totals.time += drive.duration;
    totals.night += isNight(start) ? 1 : 0;
    totals.gforce = Math.max(totals.gforce, drive.maxG ?? 0);
    totals.smooth += (drive.score ?? 0) >= SMOOTH_SCORE ? 1 : 0;
    totals.clean += drive.harshBrakes + drive.rapidAccels === 0 && drive.distance >= CLEAN_MIN_METERS ? 1 : 0;
    totals.streak = Math.max(totals.streak, streak);
    if (weeklyGoal) {
      const week = mondayOf(day);
      const done = (weekDrives.get(week) ?? 0) + 1;
      weekDrives.set(week, done);
      if (done === weeklyGoal) {
        const run = (goalRuns.get(addDays(week, -7)) ?? 0) + 1;
        goalRuns.set(week, run);
        totals.goal_weeks += 1;
        totals.goal_run = Math.max(totals.goal_run, run);
      }
    }
    for (const entry of CATALOG) {
      if (!unlocked.has(entry.id) && totals[keyOf(entry)] >= entry.target) {
        unlocked.set(entry.id, drive);
      }
    }
  }

  return CATALOG.map((entry) => {
    const by = unlocked.get(entry.id);
    return {...entry, progress: Math.min(totals[keyOf(entry)], entry.target), unlocked_at: by?.startTime ?? null, trip_id: by?.id ?? null};
  });
}

export function achievementsOverview(achievements: Achievement[]): AchievementsOverview {
  const earned = achievements.filter((x) => x.unlocked_at != null);
  const xp = earned.reduce((sum, x) => sum + x.xp, 0);
  const [level, title, start, next] = levelFor(xp);
  return {xp, level, title, level_start_xp: start, next_level_xp: next, unlocked: earned.length, total: achievements.length, achievements};
}
