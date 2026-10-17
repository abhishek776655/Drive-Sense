import {useEffect, useState} from 'react';
import {Animated, Easing, View, type StyleProp, type TextStyle} from 'react-native';
import {AppText} from './AppText';

type Weight = 'semibold' | 'bold' | 'extrabold' | 'black';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
/** One digit's roll: quick, then settles, like a timer. */
const ROLL_MS = 320;

function Digit({digit, size, lineHeight, weight, color, style}: {digit: number; size: number; lineHeight: number; weight: Weight; color?: string; style?: StyleProp<TextStyle>}) {
  const [offset] = useState(() => new Animated.Value(-digit * lineHeight));
  useEffect(() => {
    Animated.timing(offset, {toValue: -digit * lineHeight, duration: ROLL_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true}).start();
  }, [digit, lineHeight, offset]);
  return (
    <View style={{height: lineHeight, overflow: 'hidden'}}>
      <Animated.View style={{transform: [{translateY: offset}]}}>
        {DIGITS.map((d) => (
          <AppText key={d} size={size} weight={weight} color={color} style={[{lineHeight, textAlign: 'center'}, style]}>
            {d}
          </AppText>
        ))}
      </Animated.View>
    </View>
  );
}

interface RollingNumberProps {
  value: number;
  size: number;
  lineHeight: number;
  weight?: Weight;
  color?: string;
  style?: StyleProp<TextStyle>;
}

/**
 * A whole number whose digits roll to the new value like a timer or odometer: each place is a
 * strip of 0–9 that slides, so 47 → 48 moves only the last digit.
 */
export function RollingNumber({value, size, lineHeight, weight = 'black', color, style}: RollingNumberProps) {
  const digits = String(Math.max(0, Math.round(value))).split('').map(Number);
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={String(Math.round(value))} style={{flexDirection: 'row', justifyContent: 'center'}}>
      {digits.map((d, i) => (
        // Keyed by place from the right, so a new leading digit does not restart the others.
        <Digit key={digits.length - i} digit={d} size={size} lineHeight={lineHeight} weight={weight} color={color} style={style} />
      ))}
    </View>
  );
}
