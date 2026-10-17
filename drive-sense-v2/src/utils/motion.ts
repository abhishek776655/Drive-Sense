import {GRAVITY_MPS2, HARSH_BRAKE_MPS2, RAPID_ACCELERATION_MPS2} from './drivingThresholds';

export type Smoothness = 'smooth' | 'moderate' | 'harsh';

/**
 * Horizontal acceleration from a total accelerometer reading (m/s², gravity included), by
 * removing gravity Pythagorean-style. Orientation-independent, as in mobile-expo's gauge. A reading
 * of 0 or less means "no data".
 */
export const horizontalAccel = (magnitudeMps2: number): number | null =>
  magnitudeMps2 > 0 ? Math.sqrt(Math.max(0, magnitudeMps2 ** 2 - GRAVITY_MPS2 ** 2)) : null;

/** Same thresholds as event detection: harsh at brake level, moderate at rapid-accel level. */
export const smoothnessFor = (accelMps2: number | null): Smoothness | null => {
  if (accelMps2 == null) {
    return null;
  }
  if (accelMps2 >= Math.abs(HARSH_BRAKE_MPS2)) {
    return 'harsh';
  }
  if (accelMps2 >= RAPID_ACCELERATION_MPS2) {
    return 'moderate';
  }
  return 'smooth';
};

export const toG = (accelMps2: number): number => accelMps2 / GRAVITY_MPS2;
