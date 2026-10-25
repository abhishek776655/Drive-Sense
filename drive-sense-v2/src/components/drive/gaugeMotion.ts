import {useEffect} from 'react';
import {useSharedValue, withSpring, type SharedValue} from 'react-native-reanimated';
import {GAUGE_START_DEG, GAUGE_SWEEP_DEG} from '../../utils/gaugeMath';
import {useReduceMotion} from '../onboarding/motion';

/**
 * Motion for the Drive speedometer's Skia dials: one shared value per reading that springs to each
 * new speed (critically damped, so it sweeps like a needle and never overshoots), and the worklet
 * geometry the faces derive their arcs, tips and needles from on the UI thread.
 */
export function useSpringTo(target: number): SharedValue<number> {
  const reduce = useReduceMotion();
  const value = useSharedValue(target);
  useEffect(() => {
    value.set(reduce ? target : withSpring(target, {dampingRatio: 1, duration: 450}));
  }, [target, reduce, value]);
  return value;
}

/** Angle on the dial (degrees clockwise from 3 o'clock) of a 0–1 share. */
export const angleOf = (share: number) => {
  'worklet';
  return GAUGE_START_DEG + GAUGE_SWEEP_DEG * Math.min(1, Math.max(0, share));
};

/** Point at `deg` on a circle around the 200-grid centre. */
export const pointAt = (r: number, deg: number) => {
  'worklet';
  const rad = (deg * Math.PI) / 180;
  return {x: 100 + r * Math.cos(rad), y: 100 + r * Math.sin(rad)};
};
