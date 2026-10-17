import {useEffect, useState, type ReactNode} from 'react';
import {AccessibilityInfo, Animated, Easing, type StyleProp, type ViewStyle} from 'react-native';

/** Gap between staggered items fading in, in ms (spec 2026-10-17, onboarding, section 3). */
export const STAGGER_MS = 60;

/** Reduce Motion, read once per mount: movement is dropped and only the fades remain. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => alive && setReduce(value))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return reduce;
}

/**
 * A step arriving: it springs in from the side it is travelling from (from the right going forward,
 * from the left going back) while fading up. Remount it with a new `key` per step.
 */
export function StepEnter({direction, children, style}: {direction: 1 | -1; children: ReactNode; style?: StyleProp<ViewStyle>}) {
  const reduce = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.spring(progress, {toValue: 1, damping: 18, stiffness: 160, mass: 0.9, useNativeDriver: true}).start();
  }, [progress]);
  const offset = reduce ? 0 : 28 * direction;
  return (
    <Animated.View
      style={[
        {flex: 1, opacity: progress.interpolate({inputRange: [0, 0.6, 1], outputRange: [0, 0.9, 1]})},
        {transform: [{translateX: progress.interpolate({inputRange: [0, 1], outputRange: [offset, 0]})}]},
        style,
      ]}>
      {children}
    </Animated.View>
  );
}

/** Fades up 12 pt after `index` stagger steps, so a screen's lines arrive one after another. */
export function FadeUp({index = 0, children, style}: {index?: number; children: ReactNode; style?: StyleProp<ViewStyle>}) {
  const reduce = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 420,
      delay: 90 + index * STAGGER_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress, index]);
  return (
    <Animated.View
      style={[
        {opacity: progress, transform: [{translateY: progress.interpolate({inputRange: [0, 1], outputRange: [reduce ? 0 : 12, 0]})}]},
        style,
      ]}>
      {children}
    </Animated.View>
  );
}
