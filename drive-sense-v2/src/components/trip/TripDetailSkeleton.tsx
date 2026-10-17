import {useEffect, useState} from 'react';
import {Animated, Easing, View} from 'react-native';
import {useAppTheme} from '../../theme/ThemeProvider';

/** Placeholder with the trip page's shape and a soft pulse while the drive loads. */
export function TripDetailSkeleton() {
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
  const block = (height: number, flex?: number) => <View style={{height, flex, borderRadius: theme.radius.card, backgroundColor: c.card}} />;
  return (
    <Animated.View accessibilityLabel="Loading drive" style={{gap: theme.space.cardGap, opacity}}>
      {block(260)}
      {block(96)}
      {block(110)}
      <View style={{flexDirection: 'row', gap: theme.space.cardGap}}>
        {block(66, 1)}
        {block(66, 1)}
      </View>
      <View style={{flexDirection: 'row', gap: theme.space.cardGap}}>
        {block(66, 1)}
        {block(66, 1)}
      </View>
    </Animated.View>
  );
}
