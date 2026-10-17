import {elevationProfile} from '../elevation';
import {cleanPoints} from '../prepare';
import {pt} from '../../../testUtils/tripPoints';

describe('elevationProfile', () => {
  it('is null with fewer than two real altitudes', () => {
    expect(elevationProfile(cleanPoints([pt(0, 0, 1, 0), pt(1, 1, 1, 210)]))).toBeNull();
  });

  it('counts climb and drop, ignoring jitter under 3 m', () => {
    const alts = [200, 201, 199, 200, 210, 211, 205, 204];
    const p = elevationProfile(cleanPoints(alts.map((a, i) => pt(i, i * 10, 10, a))))!;
    // ref 200; 201/199/200 within 3 m; 210 → +10 (ref 210); 211 within; 205 → −5 (ref 205); 204 within
    expect(p.gainM).toBe(10);
    expect(p.lossM).toBe(5);
    expect(p.maxM).toBe(211);
    expect(p.minM).toBe(199);
  });

  it('caps the series length', () => {
    const p = elevationProfile(cleanPoints(Array.from({length: 1000}, (_, i) => pt(i, i, 10, 200 + (i % 7)))), 200)!;
    expect(p.series).toHaveLength(200);
  });
});

describe('elevation times', () => {
  it('splits time into climbing, flat and descending by grade', () => {
    // 10 m/s throughout: 60 s climbing 0.5 m/s (5 %), 60 s flat, 60 s descending
    const alt = (s: number) => (s <= 60 ? 200 + s * 0.5 : s <= 120 ? 230 : 230 - (s - 120) * 0.5);
    const p = elevationProfile(cleanPoints(Array.from({length: 181}, (_, s) => pt(s, s * 10, 10, alt(s)))))!;
    expect(p.climbS).toBe(60);
    expect(p.flatS).toBe(60);
    expect(p.descentS).toBe(60);
  });
});
