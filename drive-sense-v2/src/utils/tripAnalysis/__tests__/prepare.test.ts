import {cleanPoints, segments} from '../prepare';
import {pt} from '../../../testUtils/tripPoints';

describe('cleanPoints', () => {
  it('sorts by time and drops unparseable timestamps', () => {
    const out = cleanPoints([pt(2, 20, 10), {...pt(1, 10, 10), recorded_at: 'nope'}, pt(0, 0, 10)]);
    expect(out.map((p) => p.t - out[0].t)).toEqual([0, 2000]);
  });

  it('uses GPS speed when present, otherwise distance over time', () => {
    const out = cleanPoints([pt(0, 0, null), pt(2, 20, null)]);
    expect(out[1].mps).toBeCloseTo(10, 1);
  });

  it('replaces a spike with the last trusted speed, and trusts the reading after it', () => {
    const out = cleanPoints([pt(0, 0, 10), pt(1, 10, 40), pt(2, 20, 11)]);
    expect(out.map((p) => p.mps)).toEqual([10, 10, 11]);
  });

  it('accepts a real speed-up after a rejected reading', () => {
    // standing, then 10 m/s: the first 10 is a 10 m/s² jump in 1 s (rejected), the next is 10 over 2 s (kept)
    const out = cleanPoints([pt(0, 0, 0), pt(1, 0, 0), pt(2, 10, 10), pt(3, 20, 10), pt(4, 30, 10)]);
    expect(out.map((p) => p.mps)).toEqual([0, 0, 0, 10, 10]);
  });

  it('keeps null and zero altitudes as null', () => {
    const out = cleanPoints([pt(0, 0, 1, 0), pt(1, 1, 1, null), pt(2, 2, 1, 210)]);
    expect(out.map((p) => p.altitude)).toEqual([null, null, 210]);
  });
});

describe('segments', () => {
  it('uses the first point speed across a short gap', () => {
    const [seg] = segments(cleanPoints([pt(0, 0, 10), pt(2, 20, 12)]));
    expect(seg.kmh).toBeCloseTo(36);
    expect(seg.seconds).toBe(2);
    expect(seg.meters).toBeCloseTo(20, 0);
  });

  it('uses distance over time across a long gap (stopped at a light)', () => {
    const [seg] = segments(cleanPoints([pt(0, 0, 8), pt(60, 5, 8)]));
    expect(seg.kmh).toBeLessThan(5);
  });

  it('drops gaps over ten minutes (a paused drive)', () => {
    expect(segments(cleanPoints([pt(0, 0, 10), pt(700, 10, 10)]))).toEqual([]);
  });
});
