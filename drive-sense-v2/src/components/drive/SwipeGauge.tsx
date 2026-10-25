import * as Haptics from 'expo-haptics';
import {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Gesture, GestureDetector, GestureHandlerRootView} from 'react-native-gesture-handler';
import Animated, {Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming} from 'react-native-reanimated';
import {useDriveSettingsStore, type GaugeStyle} from '../../stores/driveSettingsStore';
import {useAppTheme} from '../../theme/ThemeProvider';
import {GaugeDial} from './GaugeDial';
import {GAUGE_STYLE_OPTIONS} from './gaugeStyles';

/**
 * The Drive speedometer, swiped left or right to the next or previous style: the dial rolls away
 * sideways and the next one rolls in, with a light tick and the style's name shown briefly. Vertical
 * drags are left to the screen.
 */
export function SwipeGauge({speed, scale, gaugeStyle, accent, size}: {speed: number; scale: number; gaugeStyle: GaugeStyle; accent: string; size: number}) {
  const theme = useAppTheme();
  const update = useDriveSettingsStore((s) => s.update);
  const roll = useSharedValue(0);
  const label = useSharedValue(0);
  const [name, setName] = useState<string | null>(null);

  const swapIn = (next: GaugeStyle, dir: number) => {
    update({gaugeStyle: next});
    setName(GAUGE_STYLE_OPTIONS.find((o) => o.id === next)?.label ?? null);
    roll.set(withSequence(withTiming(-dir, {duration: 0}), withSpring(0, {dampingRatio: 0.8, duration: 450})));
    label.set(withSequence(withTiming(1, {duration: 150}), withDelay(900, withTiming(0, {duration: 400}))));
  };
  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-18, 18])
    .failOffsetY([-12, 12])
    .onEnd((e) => {
      const forward = e.translationX < 0;
      const dir = forward ? -1 : 1;
      const ids = GAUGE_STYLE_OPTIONS.map((o) => o.id);
      const i = Math.max(0, ids.indexOf(gaugeStyle));
      const next = ids[(i + (forward ? 1 : ids.length - 1)) % ids.length];
      void Haptics.selectionAsync().catch(() => undefined);
      roll.set(
        withTiming(dir, {duration: 170, easing: Easing.in(Easing.quad)}, (done) => {
          if (done) {
            runOnJS(swapIn)(next, dir);
          }
        }),
      );
    });
  const rollStyle = useAnimatedStyle(() => {
    const away = Math.min(1, Math.abs(roll.value));
    return {opacity: 1 - away, transform: [{perspective: 900}, {translateX: roll.value * size * 0.25}, {rotateY: `${roll.value * 40}deg`}, {scale: 1 - away * 0.1}]};
  });
  const labelStyle = useAnimatedStyle(() => ({opacity: label.value, transform: [{translateY: (1 - label.value) * 6}]}));

  return (
    <GestureHandlerRootView style={{width: size, height: size}}>
      <GestureDetector gesture={swipe}>
        <View style={{width: size, height: size}} accessibilityHint="Swipe left or right to change the speedometer style">
          <Animated.View style={rollStyle}>
            <GaugeDial speed={speed} scale={scale} gaugeStyle={gaugeStyle} accent={accent} size={size} />
          </Animated.View>
          <Animated.View pointerEvents="none" style={[styles.label, labelStyle]}>
            <Text style={[styles.labelText, {color: theme.colors.textSecondary, fontFamily: theme.font.extrabold}]}>{name}</Text>
          </Animated.View>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  label: {position: 'absolute', left: 0, right: 0, bottom: -18, alignItems: 'center'},
  labelText: {fontSize: 12, letterSpacing: 2, textTransform: 'uppercase'},
});
