import * as Haptics from 'expo-haptics';
import {useEffect, type ReactNode} from 'react';
import {StyleSheet, View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {clamp, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, type SharedValue} from 'react-native-reanimated';
import {CLUSTER_INK} from '../accents';

const SPRING = {damping: 22, stiffness: 190, mass: 0.9};

function Page({index, offset, width, children}: {index: number; offset: SharedValue<number>; width: number; children: ReactNode}) {
  // Distance from the centre in pages: 0 is the current page, ±1 its neighbours.
  const style = useAnimatedStyle(() => {
    const d = index - offset.value;
    const away = Math.min(1, Math.abs(d));
    return {
      opacity: interpolate(away, [0, 1], [1, 0.4]),
      transform: [{translateX: d * width * 0.82}, {scale: interpolate(away, [0, 1], [1, 0.94])}, {translateY: away * 6}],
      zIndex: Math.round(10 - away * 10),
    };
  });
  return <Animated.View style={[StyleSheet.absoluteFill, style]}>{children}</Animated.View>;
}

function Dot({index, offset, accent}: {index: number; offset: SharedValue<number>; accent: string}) {
  const style = useAnimatedStyle(() => {
    const near = 1 - Math.min(1, Math.abs(index - offset.value));
    return {width: 6 + 14 * near, opacity: 0.35 + 0.65 * near, backgroundColor: near > 0.5 ? accent : CLUSTER_INK.textDim};
  });
  return <Animated.View style={[styles.dot, style]} />;
}

/**
 * The cluster's centre pages (spec 2026-10-25, cluster mode, section 5): the page follows the finger,
 * springs to the nearest on release (velocity-aware), neighbours sit back (smaller, dimmer, lower),
 * the active dot stretches into a pill, and a light tick plays when a page settles.
 */
export function CentrePager({pages, width, height, accent}: {pages: {key: string; node: ReactNode}[]; width: number; height: number; accent: string}) {
  const offset = useSharedValue(0);
  const start = useSharedValue(0);
  const last = pages.length - 1;

  // A page disappearing (adapter lost) must not leave the pager past the end.
  useEffect(() => {
    if (offset.value > last) {
      offset.set(withSpring(last, SPRING));
    }
  }, [last, offset]);

  const tick = () => void Haptics.selectionAsync().catch(() => undefined);
  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onBegin(() => {
      start.set(offset.value);
    })
    .onUpdate((e) => {
      // 1:1 with the finger, with a little resistance past the ends.
      const raw = start.value - e.translationX / width;
      offset.set(raw < 0 ? raw * 0.3 : raw > last ? last + (raw - last) * 0.3 : raw);
    })
    .onEnd((e) => {
      const projected = offset.value - (e.velocityX / width) * 0.25;
      const target = clamp(Math.round(projected), 0, last);
      offset.set(withSpring(target, {...SPRING, velocity: -e.velocityX / width}, (done) => {
        if (done) {
          runOnJS(tick)();
        }
      }));
    });

  return (
    <View style={{width, height}}>
      <GestureDetector gesture={pan}>
        <View style={{flex: 1, overflow: 'hidden'}}>
          {pages.map((p, i) => (
            <Page key={p.key} index={i} offset={offset} width={width}>
              {p.node}
            </Page>
          ))}
        </View>
      </GestureDetector>
      <View style={styles.dots}>
        {pages.map((p, i) => (
          <Dot key={p.key} index={i} offset={offset} accent={accent} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dots: {flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, height: 14},
  dot: {height: 6, borderRadius: 3},
});
