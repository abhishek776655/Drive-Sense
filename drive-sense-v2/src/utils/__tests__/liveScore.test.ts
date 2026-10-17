import fs from 'fs';
import path from 'path';
import {ACCELERATION_PENALTY_WEIGHT, BRAKING_PENALTY_WEIGHT, liveScore, OVERSPEED_PENALTY_WEIGHT} from '../liveScore';

const BACKEND = path.join(__dirname, '..', '..', '..', '..', 'backend', 'app', 'services', 'driving_score_service.py');

const backendWeight = (source: string, name: string): number => {
  const match = new RegExp(`^${name}\\s*=\\s*([\\d.]+)`, 'm').exec(source);
  if (!match) {
    throw new Error(`${name} not found in driving_score_service.py`);
  }
  return Number(match[1]);
};

describe('live score', () => {
  it('uses exactly the backend weights', () => {
    const source = fs.readFileSync(BACKEND, 'utf8');
    expect(BRAKING_PENALTY_WEIGHT).toBe(backendWeight(source, 'BRAKING_PENALTY_WEIGHT'));
    expect(ACCELERATION_PENALTY_WEIGHT).toBe(backendWeight(source, 'ACCELERATION_PENALTY_WEIGHT'));
    expect(OVERSPEED_PENALTY_WEIGHT).toBe(backendWeight(source, 'OVERSPEED_PENALTY_WEIGHT'));
  });

  it('matches the server formula: floored and clamped', () => {
    expect(liveScore({brakeCount: 0, accelCount: 0, overspeedIntensity: 0})).toBe(100);
    expect(liveScore({brakeCount: 2, accelCount: 1, overspeedIntensity: 0})).toBe(94);
    expect(liveScore({brakeCount: 0, accelCount: 1, overspeedIntensity: 1.2})).toBe(98);
    expect(liveScore({brakeCount: 60, accelCount: 0, overspeedIntensity: 0})).toBe(0);
  });
});
