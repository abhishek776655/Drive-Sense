import {getRouteSummary} from '../tripRoute';

describe('getRouteSummary', () => {
  it('summarizes timed route samples into distance, speed, and band stats', () => {
    const summary = getRouteSummary([
      {
        latitude: 12.9716,
        longitude: 77.5946,
        recorded_at: '2026-05-16T10:00:00Z',
      },
      {
        latitude: 12.9726,
        longitude: 77.5946,
        recorded_at: '2026-05-16T10:00:20Z',
      },
    ]);

    expect(summary.sampleCount).toBe(2);
    expect(summary.totalDurationSeconds).toBe(20);
    expect(summary.totalDistanceMeters).toBeGreaterThan(100);
    expect(summary.averageSpeedKph).toBeGreaterThan(15);
    expect(summary.bandStats.some((band) => band.distanceMeters > 0)).toBe(true);
  });
});
