/**
 * Cornering force (spec 2026-10-25, telemetry sources, section 3): the car's turn rate times its
 * speed is the sideways acceleration felt in a corner. The turn rate is the phone's rotation about
 * gravity, so it reads the same whether the phone lies flat, stands in a mount or sits in a pocket.
 */

const G = 9.81;
const DEG = Math.PI / 180;

/** Rotation rate (DeviceMotion, °/s on x/y/z as alpha/beta/gamma) about the gravity axis, in rad/s. */
export const yawRateRadS = (r: {alpha: number; beta: number; gamma: number}, gravity: {x: number; y: number; z: number}): number => {
  const len = Math.hypot(gravity.x, gravity.y, gravity.z) || 1;
  return ((r.alpha * gravity.x + r.beta * gravity.y + r.gamma * gravity.z) / len) * DEG;
};

/** Sideways G in a turn: v·ω over g. Direction is not kept; a hard left counts like a hard right. */
export const lateralG = (yawRadS: number, speedMps: number): number => (speedMps <= 0 ? 0 : Math.abs(yawRadS * speedMps) / G);

/** A turn starts above this and ends below the lower line, so one corner isn't split by a wobble. */
export const CORNER_ENTER_G = 0.15;
export const CORNER_EXIT_G = 0.08;

export type Corner = {peakG: number; at: number; latitude: number; longitude: number};
export type CornerState = {inTurn: boolean; current: Corner | null; count: number; hardest: Corner | null};
export const EMPTY_CORNERS: CornerState = {inTurn: false, current: null, count: 0, hardest: null};

/** One lateral-G reading into the turn tracker: a turn's peak (and where it was), and the drive's hardest. */
export const stepCorner = (s: CornerState, g: number, at: number, where: {latitude: number; longitude: number} | null): CornerState => {
  const here = {latitude: where?.latitude ?? NaN, longitude: where?.longitude ?? NaN};
  if (!s.inTurn) {
    return g >= CORNER_ENTER_G ? {...s, inTurn: true, current: {peakG: g, at, ...here}} : s;
  }
  const current = s.current && g > s.current.peakG ? {peakG: g, at, ...here} : s.current;
  if (g >= CORNER_EXIT_G) {
    return {...s, current};
  }
  const hardest = current && (!s.hardest || current.peakG > s.hardest.peakG) ? current : s.hardest;
  return {inTurn: false, current: null, count: s.count + 1, hardest};
};
