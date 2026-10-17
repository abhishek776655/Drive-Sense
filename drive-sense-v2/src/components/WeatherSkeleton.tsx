import {useEffect, useState} from 'react';
import {Animated, Easing, View} from 'react-native';
import {useAppTheme} from '../theme/ThemeProvider';

/** Placeholder with the weather card's shape and a soft pulse while the forecast loads. */
export function WeatherSkeleton() {
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
  const block = (width: number | `${number}%`, height: number, radius = 10) => (
    <View style={{width, height, borderRadius: radius, backgroundColor: c.separator}} />
  );

  return (
    <View
      accessibilityLabel="Loading weather"
      style={{borderRadius: theme.radius.hero, minHeight: 190, padding: 18, backgroundColor: c.card, overflow: 'hidden'}}>
      <Animated.View style={{flex: 1, opacity, justifyContent: 'space-between'}}>
        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
          {block(120, 22, 11)}
          {block(56, 56, 28)}
        </View>
        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end'}}>
          <View style={{gap: 10}}>
            {block(110, 54, 14)}
            {block(140, 18)}
          </View>
          {block(140, 40, 16)}
        </View>
      </Animated.View>
    </View>
  );
}
