import {CORNER_ENTER_G, EMPTY_CORNERS, lateralG, stepCorner, yawRateRadS} from '../cornering';

describe('cornering', () => {
  it('takes the turn rate about gravity, whatever way the phone is held', () => {
    // Phone flat (gravity along −z): yaw is rotation about z (gamma).
    expect(yawRateRadS({alpha: 0, beta: 0, gamma: 57.2958}, {x: 0, y: 0, z: -9.81})).toBeCloseTo(-1, 3);
    // Phone upright in a mount (gravity along −y): yaw is rotation about y (beta).
    expect(yawRateRadS({alpha: 0, beta: 28.6479, gamma: 0}, {x: 0, y: -9.81, z: 0})).toBeCloseTo(-0.5, 3);
  });

  it('turns turn rate and speed into sideways G', () => {
    // 0.2 rad/s at 20 m/s = 4 m/s² ≈ 0.41 g; the sign is dropped.
    expect(lateralG(-0.2, 20)).toBeCloseTo(0.408, 2);
    expect(lateralG(0.5, 0)).toBe(0);
  });

  it('keeps one peak per turn and the hardest corner of the drive', () => {
    let s = EMPTY_CORNERS;
    const gs = [0.05, 0.2, 0.32, 0.25, 0.05, 0.1, 0.18, 0.45, 0.2, 0.06];
    gs.forEach((g, i) => {
      s = stepCorner(s, g, i * 100, {latitude: i, longitude: 2});
    });
    expect(s.count).toBe(2);
    expect(s.hardest).toMatchObject({peakG: 0.45, at: 700, latitude: 7});
    expect(s.inTurn).toBe(false);
    expect(CORNER_ENTER_G).toBe(0.15);
    expect(stepCorner(EMPTY_CORNERS, 0.3, 0, null).current).toMatchObject({peakG: 0.3, latitude: NaN});
  });
});
