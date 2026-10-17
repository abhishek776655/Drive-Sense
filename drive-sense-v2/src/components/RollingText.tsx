import {useFocusEffect} from 'expo-router';
import {useCallback, useState} from 'react';
import {Animated, Easing, View, type StyleProp, type TextStyle} from 'react-native';
import {AppText} from './AppText';

type Weight = 'semibold' | 'bold' | 'extrabold' | 'black';
type Tone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'onAccent';

/** Each letter starts this much later than the one before. */
const STAGGER_MS = 28;
/** How long one letter takes to roll into place. */
const LETTER_MS = 380;

interface RollingTextProps {
  children: string;
  size: number;
  lineHeight: number;
  weight?: Weight;
  tone?: Tone;
  /** Extra wait before the first letter, to run after another RollingText. */
  delayMs?: number;
  style?: StyleProp<TextStyle>;
}

/**
 * Text whose letters roll up into place one after another, like the digits of a timer. Plays each
 * time the screen comes into focus (switching tabs). One animated value drives every letter.
 */
export function RollingText({children, size, lineHeight, weight = 'black', tone = 'primary', delayMs = 0, style}: RollingTextProps) {
  const [progress] = useState(() => new Animated.Value(1));
  const letters = Array.from(children);
  const total = delayMs + (letters.length - 1) * STAGGER_MS + LETTER_MS;

  useFocusEffect(
    useCallback(() => {
      progress.setValue(0);
      const run = Animated.timing(progress, {toValue: 1, duration: total, easing: Easing.linear, useNativeDriver: true});
      run.start();
      return () => run.stop();
    }, [progress, total]),
  );

  return (
    <View accessible accessibilityRole="header" accessibilityLabel={children} style={{flexDirection: 'row'}}>
      {letters.map((letter, i) => {
        const start = (delayMs + i * STAGGER_MS) / total;
        const end = (delayMs + i * STAGGER_MS + LETTER_MS) / total;
        // Ease-out by keyframe (native-driven interpolation takes no easing): three quarters of
        // the travel in the first third of the letter's time, then it settles.
        const knee = start + (end - start) / 3;
        const inputRange = [0, start, knee, end, 1];
        const translateY = progress.interpolate({inputRange, outputRange: [lineHeight, lineHeight, lineHeight * 0.25, 0, 0], extrapolate: 'clamp'});
        const opacity = progress.interpolate({inputRange, outputRange: [0, 0, 0.8, 1, 1], extrapolate: 'clamp'});
        return (
          <View key={`${i}-${letter}`} style={{height: lineHeight, overflow: 'hidden'}}>
            <Animated.View style={{transform: [{translateY}], opacity}}>
              <AppText size={size} weight={weight} tone={tone} style={[{lineHeight}, style]}>
                {letter === ' ' ? ' ' : letter}
              </AppText>
            </Animated.View>
          </View>
        );
      })}
    </View>
  );
}
