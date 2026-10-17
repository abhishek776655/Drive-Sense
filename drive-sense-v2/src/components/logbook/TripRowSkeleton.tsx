import {useEffect, useState} from 'react';
import {Animated, Easing, View} from 'react-native';
import {useAppTheme} from '../../theme/ThemeProvider';

/** Placeholder rows with a soft pulse while the first page loads. */
export function TripRowSkeleton({count = 4}: {count?: number}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true}),
        Animated.timing(pulse, {toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true}),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const opacity = pulse.interpolate({inputRange: [0, 1], outputRange: [0.45, 0.9]});
  return (
    <Animated.View accessibilityLabel="Loading drives" style={{gap: theme.space.cardGap, opacity}}>
      {Array.from({length: count}, (_, i) => (
        <View key={i} style={{height: 98, borderRadius: 44, backgroundColor: c.card}} />
      ))}
    </Animated.View>
  );
}
