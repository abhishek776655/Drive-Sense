import {statsFacts} from '../db/repos';
import {achievementsOverview, computeAchievements} from '../stats/achievements';
import {currentProfile, localFirst} from '../stats/source';
import {apiClient} from './apiClient';
import {timeZone} from './homeService';

export type AchievementCategory = 'distance' | 'drives' | 'time' | 'streak' | 'night' | 'gforce' | 'smooth';

export interface Achievement {
  id: string;
  category: AchievementCategory;
  title: string;
  description: string;
  xp: number;
  /** In the category's unit: metres, drives, seconds, days or G. */
  target: number;
  progress: number;
  unlocked_at: string | null;
  /** The drive that unlocked it. */
  trip_id: string | null;
}

/** Shape of `GET /achievements`. */
export interface AchievementsOverview {
  xp: number;
  level: number;
  title: string;
  level_start_xp: number;
  next_level_xp: number | null;
  unlocked: number;
  total: number;
  achievements: Achievement[];
}

export const achievementsService = {
  /** Worked out on the phone once it holds every drive (local-first part 2c), else the server's. */
  get: (): Promise<AchievementsOverview> =>
    localFirst(
      'achievements',
      (db) => achievementsOverview(computeAchievements(statsFacts(db), currentProfile(db)?.weekly_goal ?? null)),
      async () => (await apiClient.get<AchievementsOverview>('/api/v1/achievements', {params: {tz: timeZone()}})).data,
    ),
};
