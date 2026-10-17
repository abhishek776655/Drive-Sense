import {pt} from '../../../testUtils/tripPoints';
import {bucketMinutesFor, distanceByTime} from '../distanceByTime';
import {cleanPoints, segments} from '../prepare';

describe('bucketMinutesFor', () => {
  it('uses hours for long drives and shorter buckets for short ones', () => {
    expect(bucketMinutesFor(4 * 60)).toBe(1);
    expect(bucketMinutesFor(20 * 60)).toBe(5);
    expect(bucketMinutesFor(90 * 60)).toBe(15);
    expect(bucketMinutesFor(4 * 3600)).toBe(60);
  });
});

describe('distanceByTime', () => {
  it('adds each segment to the clock bucket it starts in', () => {
    // 10 m/s for 12 minutes from 14:00 UTC: 6 km, i.e. 3 km per 5-minute… split 3 km / 3 km / 0 across 14:00, 14:05, 14:10
    const segs = segments(cleanPoints(Array.from({length: 721}, (_, s) => pt(s, s * 10, 10))));
    const buckets = distanceByTime(segs, 5);
    expect(buckets.map((b) => Math.round(b.meters))).toEqual([3000, 3000, 1200]);
    expect(buckets[0].start).toBe(Date.UTC(2026, 9, 11, 14, 0));
    expect(buckets[2].start).toBe(Date.UTC(2026, 9, 11, 14, 10));
  });

  it('is empty without movement', () => {
    expect(distanceByTime([], 5)).toEqual([]);
  });
});
