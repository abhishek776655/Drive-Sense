import {cleanPoints, segments} from '../prepare';
import {timeAtSpeed, tripTimes} from '../times';
import {pt} from '../../../testUtils/tripPoints';

// 10 s at 36 km/h, then a 60 s stop with no points, then 10 s at 90 km/h.
const route = () =>
  segments(
    cleanPoints([
      ...Array.from({length: 11}, (_, i) => pt(i, i * 10, 10)),
      ...Array.from({length: 11}, (_, i) => pt(70 + i, 100 + i * 25, 25)),
    ]),
  );

describe('tripTimes', () => {
  it('splits moving and idle time', () => {
    const t = tripTimes(route());
    expect(t.movingS).toBe(20);
    expect(t.idleS).toBe(60);
  });

  it('is zero for no segments', () => {
    expect(tripTimes([])).toEqual({movingS: 0, idleS: 0});
  });
});

describe('timeAtSpeed', () => {
  it('puts moving time into bands with shares of moving time', () => {
    const bands = timeAtSpeed(route());
    expect(bands.map((b) => b.label)).toEqual(['0–20', '20–40', '40–60', '60–80', '80–100', '100+']);
    expect(bands[1].seconds).toBe(10);
    expect(bands[4].seconds).toBe(10);
    expect(bands[1].share).toBeCloseTo(0.5);
    expect(bands[0].seconds).toBe(0); // the stop is not driving
  });

  it('returns zero shares with no movement', () => {
    expect(timeAtSpeed([]).every((b) => b.share === 0)).toBe(true);
  });
});
