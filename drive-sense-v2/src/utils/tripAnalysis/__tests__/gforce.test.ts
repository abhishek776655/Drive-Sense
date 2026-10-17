import {pt} from '../../../testUtils/tripPoints';
import {gForceSeries} from '../gforce';
import {cleanPoints} from '../prepare';

describe('gForceSeries', () => {
  it('turns speed changes into signed G with peak acceleration and braking', () => {
    // 0 → 6 m/s over 3 s (≈0.2 g), cruise, then 6 → 0 in 2 s (≈0.31 g braking)
    const speeds = [0, 2, 4, 6, 6, 6, 3, 0];
    const {samples, peakAccel, peakBrake} = gForceSeries(cleanPoints(speeds.map((v, i) => pt(i, i * 5, v))));
    expect(samples.length).toBe(7);
    expect(peakAccel!.g).toBeCloseTo(2 / 9.80665, 3);
    expect(peakBrake!.g).toBeCloseTo(-3 / 9.80665, 3);
  });

  it('skips long gaps, where a speed change is not a real acceleration', () => {
    expect(gForceSeries(cleanPoints([pt(0, 0, 0), pt(30, 100, 10)])).samples).toEqual([]);
  });

  it('drops changes no car can make', () => {
    // 8 → 22 m/s between two fixes 1 s apart reads as 1.4 g: a GPS or simulator jump
    const {peakAccel} = gForceSeries(cleanPoints([pt(0, 0, 8), pt(1, 8, 8), pt(2, 30, 22), pt(3, 52, 22)]));
    expect(peakAccel === null || peakAccel.g <= 9 / 9.80665).toBe(true);
  });

  it('has no peaks without movement', () => {
    const {peakAccel, peakBrake} = gForceSeries(cleanPoints([pt(0, 0, 5), pt(1, 5, 5)]));
    expect(peakAccel).toBeNull();
    expect(peakBrake).toBeNull();
  });
});
