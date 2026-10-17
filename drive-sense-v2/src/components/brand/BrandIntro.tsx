import {StatusBar} from 'expo-status-bar';
import {useEffect, useState} from 'react';
import {AccessibilityInfo, Animated, Easing, Pressable, StyleSheet} from 'react-native';
import {BRAND_INK, BRAND_PAPER, BRAND_ROAD} from '../../brand/logo';
import {introTimeline, RISE_PT} from '../../brand/introTimeline';
import {AppText} from '../AppText';
import {RoadLogo} from './RoadLogo';

/** Same as `imageWidth` of the native splash in app.json, so the hand-off from it does not jump. */
const MARK_SIZE = 200;
const WORDMARK_GAP = 12;

/**
 * First-launch brand intro, drawn over the app: the splash's road starts moving (lane dashes run to
 * the horizon), rises, and the wordmark fades in under it; then the overlay fades away. A tap skips
 * to the fade. With Reduce Motion on nothing moves; the logo holds briefly and fades.
 */
export function BrandIntro({onDone}: {onDone: () => void}) {
  const [phase, setPhase] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [fadeMs, setFadeMs] = useState(300);
  const [drive] = useState(() => new Animated.Value(0));
  const [rise] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(1));

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // The dash path is SVG data, not a style, so it re-renders from the JS-driven value.
    const id = drive.addListener(({value}) => setPhase(value % 1));
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) {
          return;
        }
        const t = introTimeline(reduce);
        setFadeMs(t.fadeMs);
        Animated.parallel([
          Animated.timing(drive, {toValue: t.dashPeriods, duration: t.driveMs, easing: Easing.out(Easing.quad), useNativeDriver: false}),
          Animated.timing(rise, {toValue: 1, delay: t.riseDelayMs, duration: t.riseMs, easing: Easing.out(Easing.cubic), useNativeDriver: true}),
        ]).start();
        timer = setTimeout(() => setLeaving(true), t.holdMs);
      });
    return () => {
      cancelled = true;
      drive.removeListener(id);
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [drive, rise]);

  useEffect(() => {
    if (leaving) {
      Animated.timing(fade, {toValue: 0, duration: fadeMs, useNativeDriver: true}).start(() => onDone());
    }
  }, [leaving, fade, fadeMs, onDone]);

  return (
    <Animated.View pointerEvents={leaving ? 'none' : 'auto'} style={[StyleSheet.absoluteFill, {backgroundColor: BRAND_INK, opacity: fade}]}>
      <StatusBar style="light" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Skip intro"
        onPress={() => setLeaving(true)}
        style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
        <Animated.View style={{transform: [{translateY: rise.interpolate({inputRange: [0, 1], outputRange: [0, -RISE_PT]})}]}}>
          <RoadLogo variant="mark" size={MARK_SIZE} phase={phase} />
        </Animated.View>
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '50%',
            marginTop: MARK_SIZE / 2 - RISE_PT + WORDMARK_GAP,
            flexDirection: 'row',
            justifyContent: 'center',
            opacity: rise,
            transform: [{translateY: rise.interpolate({inputRange: [0, 1], outputRange: [WORDMARK_GAP, 0]})}],
          }}>
          <AppText size={34} weight="black" color={BRAND_PAPER}>
            Drive
          </AppText>
          <AppText size={34} weight="black" color={BRAND_ROAD}>
            Sense
          </AppText>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
