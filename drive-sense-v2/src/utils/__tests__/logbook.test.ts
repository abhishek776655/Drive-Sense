import type {TripSummary} from '../../services/tripService';
import {groupByMonth, periodRange, tripTitle} from '../logbook';

const trip = (start: string, km = 1, overrides: Partial<TripSummary> = {}): TripSummary => ({
  id: start,
  vehicle_name: 'City',
  state: 'ended',
  start_time: start,
  end_time: start,
  distance_meters: km * 1000,
  duration_seconds: 600,
  driving_score: 90,
  max_speed_mps: 10,
  start_address: null,
  end_address: null,
  event_count: 0,
  ...overrides,
});

describe('periodRange', () => {
  const now = new Date(2026, 9, 15, 14, 30); // Thu 15 Oct 2026, local

  it('starts the week on Monday at midnight', () => {
    expect(periodRange('week', now)).toEqual(new Date(2026, 9, 12));
  });

  it('starts the month, year and last 30 days correctly', () => {
    expect(periodRange('month', now)).toEqual(new Date(2026, 9, 1));
    expect(periodRange('year', now)).toEqual(new Date(2026, 0, 1));
    expect(periodRange('last30', now)).toEqual(new Date(2026, 8, 15));
  });

  it('is null for all time', () => {
    expect(periodRange('all', now)).toBeNull();
  });

  it('treats Sunday as the end of the week', () => {
    expect(periodRange('week', new Date(2026, 9, 18, 9))).toEqual(new Date(2026, 9, 12));
  });
});

describe('groupByMonth', () => {
  it('groups consecutive trips by local month with totals', () => {
    const groups = groupByMonth([
      trip(new Date(2026, 9, 11, 20).toISOString(), 5, {max_speed_mps: 20}),
      trip(new Date(2026, 9, 2, 9).toISOString(), 2),
      trip(new Date(2026, 8, 20, 9).toISOString(), 3),
    ]);
    expect(groups.map((g) => g.items.length)).toEqual([2, 1]);
    expect(groups[0].title).toBe('October 2026');
    expect(groups[0].distanceM).toBe(7000);
    expect(groups[0].durationS).toBe(1200);
    expect(groups[0].topMps).toBe(20);
  });
});

describe('tripTitle', () => {
  it('uses the city of the end address, then of the start, then Drive', () => {
    expect(tripTitle({start_address: 'A, X', end_address: 'Hall 14, South East Delhi'})).toBe('South East Delhi');
    expect(tripTitle({start_address: 'India Gate, New Delhi', end_address: null})).toBe('New Delhi');
    expect(tripTitle({start_address: null, end_address: 'Noida'})).toBe('Noida');
    expect(tripTitle({start_address: null, end_address: null})).toBe('Drive');
  });
});
