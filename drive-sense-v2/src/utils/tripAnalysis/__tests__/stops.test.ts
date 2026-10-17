import {cleanPoints, segments} from '../prepare';
import {dayPeriod, detectStops} from '../stops';
import {pt} from '../../../testUtils/tripPoints';

/** Each leg: [startSecond, count, speed m/s]; points 1 s apart, each leg continuing where the last ended. */
const drive = (...legs: [number, number, number][]) => {
  let pos = 0;
  const points = legs.flatMap(([start, count, speed]) =>
    Array.from({length: count}, (_, i) => {
      const p = pt(start + i, pos, speed);
      pos += speed;
      return p;
    }),
  );
  return segments(cleanPoints(points));
};

describe('detectStops', () => {
  it('finds a stop of 30 s or more between moving stretches', () => {
    const stops = detectStops(drive([0, 10, 10], [40, 10, 10]));
    expect(stops).toHaveLength(1);
    expect(stops[0].durationS).toBeGreaterThanOrEqual(30);
  });

  it('ignores short stops', () => {
    // a 20 s gap is too short to count
    expect(detectStops(drive([0, 10, 10], [29, 10, 10]))).toEqual([]);
  });

  it('ignores standing still at the very start or end', () => {
    expect(detectStops(drive([0, 40, 0], [40, 10, 10], [50, 40, 0]))).toEqual([]);
  });
});

describe('dayPeriod', () => {
  it('is night before 06:00 and from 19:00, local time', () => {
    expect(dayPeriod(new Date(2026, 9, 11, 20, 0).toISOString())).toBe('night');
    expect(dayPeriod(new Date(2026, 9, 11, 5, 59).toISOString())).toBe('night');
    expect(dayPeriod(new Date(2026, 9, 11, 12, 0).toISOString())).toBe('day');
  });
});
