import {gpsQuality, sensorGSeries, smoothnessScore, stopSummary, timeOverLimit} from '../quality';
import type {CleanPoint, Segment} from '../prepare';

const point = (s: number, mps: number): CleanPoint => ({t: s * 1000, latitude: 28.6, longitude: 77.2, mps, altitude: null});
const seg = (seconds: number, kmh: number): Segment => ({from: point(0, 0), to: point(seconds, 0), seconds, meters: (kmh / 3.6) * seconds, kmh});

describe('drive quality', () => {
  it('scores gentle driving near 100 and jerky driving lower', () => {
    const gentle = Array.from({length: 30}, (_, i) => point(i, 10 + i * 0.5));
    expect(smoothnessScore(gentle)).toBe(100);
    const jerky = Array.from({length: 30}, (_, i) => point(i, i % 2 ? 15 : 10));
    expect(smoothnessScore(jerky)).toBe(0);
    expect(smoothnessScore(gentle.slice(0, 5))).toBeNull();
  });

  it('measures moving time over a limit', () => {
    expect(timeOverLimit([seg(60, 50), seg(30, 110), seg(30, 2)], 100)).toEqual({seconds: 30, share: 30 / 90});
    expect(timeOverLimit([], 100).share).toBeNull();
  });

  it('summarises stops', () => {
    expect(stopSummary([])).toBeNull();
    expect(stopSummary([{startedAt: 0, durationS: 40, latitude: 0, longitude: 0}, {startedAt: 1, durationS: 120, latitude: 0, longitude: 0}])).toEqual({longestS: 120, averageS: 80});
  });

  it('grades GPS by the median accuracy', () => {
    const at = (a: number | null) => ({recorded_at: '2026-10-17T10:00:00Z', latitude: 0, longitude: 0, speed_mps: 0, altitude_m: null, accuracy_m: a});
    expect(gpsQuality([at(5), at(6), at(8)])?.grade).toBe('good');
    expect(gpsQuality([at(15), at(18), at(30)])).toMatchObject({grade: 'fair', medianM: 18});
    expect(gpsQuality([at(40), at(60)])?.grade).toBe('poor');
    expect(gpsQuality([at(null)])).toBeNull();
  });

  it('reads the phone sensor G when it was recorded', () => {
    const raw = [
      {recorded_at: '2026-10-17T10:00:02Z', latitude: 0, longitude: 0, speed_mps: 0, altitude_m: null, peak_g: 0.31},
      {recorded_at: '2026-10-17T10:00:01Z', latitude: 0, longitude: 0, speed_mps: 0, altitude_m: null, peak_g: null},
    ];
    expect(sensorGSeries(raw)).toEqual([{t: Date.parse('2026-10-17T10:00:02Z'), g: 0.31}]);
  });
});
