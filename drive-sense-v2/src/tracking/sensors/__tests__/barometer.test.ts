import {BARO_HYSTERESIS_M, fuseAltitude, pressureToAltitudeM, stepElevation} from '../barometer';

describe('barometer', () => {
  it('turns pressure into altitude (sea level at 1013.25 hPa, about 8.3 m per hPa near the ground)', () => {
    expect(pressureToAltitudeM(1013.25)).toBeCloseTo(0, 1);
    expect(pressureToAltitudeM(1012.25) - pressureToAltitudeM(1013.25)).toBeCloseTo(8.3, 0);
    expect(pressureToAltitudeM(900)).toBeCloseTo(988, -1);
  });

  it('lays the barometer change onto the GPS altitude it started from', () => {
    expect(fuseAltitude({baroM: 120, gpsM: 35}, 126.5)).toBeCloseTo(41.5, 5);
  });

  it('counts climb and descent past the hysteresis only', () => {
    let s = {refM: null as number | null, gainM: 0, lossM: 0};
    for (const alt of [100, 100.4, 100.8, 101.2, 103, 102.6, 101.5, 105]) {
      s = stepElevation(s, alt);
    }
    // 100 → 101.2 (+1.2) → 103 (+1.8) → 101.5 (−1.5) → 105 (+3.5); 102.6 is inside the band.
    expect(s.gainM).toBeCloseTo(6.5, 5);
    expect(s.lossM).toBeCloseTo(1.5, 5);
    expect(BARO_HYSTERESIS_M).toBe(1);
  });
});
