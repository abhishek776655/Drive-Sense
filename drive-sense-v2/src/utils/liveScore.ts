/**
 * Live driving score, the same formula as the backend's `driving_score_service.py`:
 * 100 − 2 × harsh brakes − 1.5 × rapid accelerations − 0.1 × Σ overspeed intensity, floored and
 * clamped to 0–100. A test reads the backend file so these weights cannot drift from it.
 */
export const BRAKING_PENALTY_WEIGHT = 2.0;
export const ACCELERATION_PENALTY_WEIGHT = 1.5;
export const OVERSPEED_PENALTY_WEIGHT = 0.1;
export const SHARP_TURN_PENALTY_WEIGHT = 1.0;

export interface ScoreInput {
  brakeCount: number;
  accelCount: number;
  /** Sum over overspeed entries of speed ÷ limit at the moment of entry (the server's intensity). */
  overspeedIntensity: number;
}

export const liveScore = ({brakeCount, accelCount, overspeedIntensity}: ScoreInput): number => {
  const score =
    100 - brakeCount * BRAKING_PENALTY_WEIGHT - accelCount * ACCELERATION_PENALTY_WEIGHT - overspeedIntensity * OVERSPEED_PENALTY_WEIGHT;
  return Math.max(0, Math.min(100, Math.trunc(score)));
};
