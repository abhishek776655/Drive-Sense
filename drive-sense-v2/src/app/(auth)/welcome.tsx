import {router} from 'expo-router';
import {useEffect, useState} from 'react';
import {Animated, Easing, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AppText} from '../../components/AppText';
import {RoadLogo} from '../../components/brand/RoadLogo';
import {GhostButton, PillButton} from '../../components/onboarding/controls';
import {FadeUp, useReduceMotion} from '../../components/onboarding/motion';
import {withAlpha} from '../../theme/color';
import {useAppTheme} from '../../theme/ThemeProvider';

/** One lane-dash period every this many ms: an unhurried cruise. */
const CRUISE_MS = 1600;

/**
 * The first auth screen (spec 2026-10-17, onboarding): the road logo cruising (its lane dashes keep
 * flowing to the horizon), the wordmark and one line of copy, then Get started or Sign in.
 */
export default function WelcomeScreen() {
  const c = useAppTheme().colors;
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const [phase, setPhase] = useState(0);
  const [drive] = useState(() => new Animated.Value(0));
  const [float] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduce) {
      return;
    }
    const id = drive.addListener(({value}) => setPhase(value));
    const cruise = Animated.loop(Animated.timing(drive, {toValue: 1, duration: CRUISE_MS, easing: Easing.linear, useNativeDriver: false}));
    cruise.start();
    Animated.spring(float, {toValue: 1, damping: 14, stiffness: 90, useNativeDriver: true}).start();
    return () => {
      cruise.stop();
      drive.removeListener(id);
    };
  }, [drive, float, reduce]);

  return (
    <View style={{flex: 1, backgroundColor: c.accent, paddingTop: insets.top, paddingBottom: insets.bottom + 16, paddingHorizontal: 24}}>
      <View style={{flex: 1, justifyContent: 'center', gap: 26}}>
        <Animated.View
          style={{
            opacity: reduce ? 1 : float,
            transform: [{translateY: float.interpolate({inputRange: [0, 1], outputRange: [reduce ? 0 : 30, 0]})}, {scale: float.interpolate({inputRange: [0, 1], outputRange: [0.92, 1]})}],
          }}>
          <RoadLogo variant="tile" size={112} phase={phase % 1} />
        </Animated.View>
        <FadeUp index={3}>
          <AppText size={52} weight="black" color={c.onAccent} style={{lineHeight: 56, letterSpacing: -1}}>
            Drive{'\n'}smarter.
          </AppText>
        </FadeUp>
        <FadeUp index={5}>
          <AppText size={18} weight="semibold" color={withAlpha(c.onAccent, 0.85)}>
            DriveSense records every drive by itself and shows you how you really drive.
          </AppText>
        </FadeUp>
      </View>
      <FadeUp index={7} style={{gap: 4}}>
        <PillButton label="Get started" onPress={() => router.push('/signup')} />
        <GhostButton label="I already have an account" onPress={() => router.push('/login')} />
      </FadeUp>
    </View>
  );
}
