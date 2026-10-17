import type {Achievement} from '../../services/achievementsService';
import {achievementDescription, levelProgress, progressLabel, sortAchievements} from '../achievements';

const a = (overrides: Partial<Achievement>): Achievement => ({
  id: 'x',
  category: 'drives',
  title: 'X',
  description: 'Complete 10 drives',
  xp: 50,
  target: 10,
  progress: 4,
  unlocked_at: null,
  trip_id: null,
  ...overrides,
});

describe('achievement helpers', () => {
  it('measures progress through the current level', () => {
    expect(levelProgress({xp: 2800, level_start_xp: 2700, next_level_xp: 3250})).toEqual({into: 100, span: 550, fraction: 100 / 550});
    expect(levelProgress({xp: 9999, level_start_xp: 9000, next_level_xp: null}).fraction).toBe(1);
  });

  it('labels progress in each category', () => {
    expect(progressLabel(a({}), 'metric')).toBe('4 / 10');
    expect(progressLabel(a({category: 'distance', progress: 62400, target: 100000}), 'metric')).toBe('62 / 100 km');
    expect(progressLabel(a({category: 'distance', progress: 62400, target: 100000}), 'imperial')).toBe('38 / 62 mi');
    expect(progressLabel(a({category: 'time', progress: 7200, target: 18000}), 'metric')).toBe('2 / 5 h');
    expect(progressLabel(a({category: 'streak', progress: 3, target: 7}), 'metric')).toBe('3 / 7 days');
    expect(progressLabel(a({category: 'gforce', progress: 0.42, target: 0.8}), 'metric')).toBe('0.42 / 0.8 G');
  });

  it('describes distance goals in the chosen units', () => {
    const century = a({category: 'distance', target: 100000, description: 'Drive a total of 100 km'});
    expect(achievementDescription(century, 'metric')).toBe('Drive a total of 100 km');
    expect(achievementDescription(century, 'imperial')).toBe('Drive a total of 62 mi');
  });

  it('puts the newest unlocks and the closest goals first', () => {
    const {unlocked, locked} = sortAchievements([
      a({id: 'old', unlocked_at: '2026-10-01T00:00:00Z'}),
      a({id: 'new', unlocked_at: '2026-10-09T00:00:00Z'}),
      a({id: 'far', progress: 1}),
      a({id: 'near', progress: 9}),
    ]);
    expect(unlocked.map((x) => x.id)).toEqual(['new', 'old']);
    expect(locked.map((x) => x.id)).toEqual(['near', 'far']);
  });
});
