import * as Haptics from 'expo-haptics';
import {useEffect, type ReactNode} from 'react';
import {StyleSheet, View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {clamp, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, type SharedValue} from 'react-native-reanimated';
import {CLUSTER_INK} from '../accents';

const SPRING = {damping: 22, stiffness: 200, mass: 0.9};

function Slide({index, offset, height, children}: {index: number; offset: SharedValue<number>; height: number; children: ReactNode}) {
  // Like a wheel: neighbours sit above and below, smaller, dimmer and tipped back.
  const style = useAnimatedStyle(() => {
    const d = index - offset.value;
    const away = Math.min(1, Math.abs(d));
    return {
      opacity: interpolate(away, [0, 0.6, 1], [1, 0.15, 0]),
      transform: [{perspective: 600}, {translateY: d * height * 0.7}, {rotateX: `${-d * 35}deg`}, {scale: interpolate(away, [0, 1], [1, 0.9])}],
    };
  });
  return <Animated.View style={[StyleSheet.absoluteFill, style]}>{children}</Animated.View>;
}

function Tick({index, offset, accent}: {index: number; offset: SharedValue<number>; accent: string}) {
  const style = useAnimatedStyle(() => {
    const near = 1 - Math.min(1, Math.abs(index - offset.value));
    return {height: 5 + 11 * near, opacity: 0.35 + 0.65 * near, backgroundColor: near > 0.5 ? accent : CLUSTER_INK.textDim};
  });
  return <Animated.View style={[styles.tick, style]} />;
}

/**
 * Views of one centre page stacked like a wheel: swipe up or down to turn to the next, with a
 * column of ticks on the right showing where you are. Horizontal swipes are left to the page pager.
 */
export function VerticalPager({views, height, accent}: {views: {key: string; node: ReactNode}[]; height: number; accent: string}) {
  const offset = useSharedValue(0);
  const start = useSharedValue(0);
  const last = views.length - 1;

  useEffect(() => {
    if (offset.value > last) {
      offset.set(withSpring(last, SPRING));
    }
  }, [last, offset]);

  const tick = () => void Haptics.selectionAsync().catch(() => undefined);
  const pan = Gesture.Pan()
    .activeOffsetY([-12, 12])
    .failOffsetX([-12, 12])
    .onBegin(() => {
      start.set(offset.value);
    })
    .onUpdate((e) => {
      const raw = start.value - e.translationY / height;
      offset.set(raw < 0 ? raw * 0.3 : raw > last ? last + (raw - last) * 0.3 : raw);
    })
    .onEnd((e) => {
      const target = clamp(Math.round(offset.value - (e.velocityY / height) * 0.25), 0, last);
      offset.set(
        withSpring(target, {...SPRING, velocity: -e.velocityY / height}, (done) => {
          if (done) {
            runOnJS(tick)();
          }
        }),
      );
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.fill}>
        <View style={[styles.fill, styles.clip]}>
          {views.map((v, i) => (
            <Slide key={v.key} index={i} offset={offset} height={height}>
              {v.node}
            </Slide>
          ))}
        </View>
        {views.length > 1 ? (
          <View style={styles.ticks} pointerEvents="none">
            {views.map((v, i) => (
              <Tick key={v.key} index={i} offset={offset} accent={accent} />
            ))}
          </View>
        ) : null}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: {flex: 1},
  clip: {overflow: 'hidden'},
  ticks: {position: 'absolute', right: 2, top: 0, bottom: 0, justifyContent: 'center', gap: 5},
  tick: {width: 3, borderRadius: 2},
});
