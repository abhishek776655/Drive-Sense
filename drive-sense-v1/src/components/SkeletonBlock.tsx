import React, {useEffect, useRef} from 'react';
import {Animated, Easing, View, type DimensionValue} from 'react-native';
import {useAppTheme} from '../theme/appTheme';

type Props = {
  height: number;
  width?: DimensionValue;
  radius?: number;
  style?: object;
};

const PULSE_DURATION_MS = 900;

export const SkeletonBlock: React.FC<Props> = ({height, width = '100%', radius = 16, style}) => {
  const theme = useAppTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // A still grey box reads as a broken layout; the pulse is what says "loading". Native driver
    // so it keeps running while JS is busy parsing the response it is waiting for.
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: PULSE_DURATION_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: PULSE_DURATION_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();

    return () => animation.stop();
  }, [pulse]);

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={[
        {
          height,
          width,
          borderRadius: radius,
          backgroundColor: theme.cardSoft,
          borderColor: theme.cardBorder,
          borderWidth: 1,
          opacity: pulse.interpolate({inputRange: [0, 1], outputRange: [0.45, 1]}),
        },
        style,
      ]}
    />
  );
};

/** A row of skeleton pills, for chip rows and stat grids. */
export const SkeletonRow: React.FC<{count: number; height?: number; gap?: number}> = ({
  count,
  height = 32,
  gap = 8,
}) => (
  <View style={{flexDirection: 'row'}}>
    {Array.from({length: count}, (_, index) => (
      <SkeletonBlock
        key={index}
        height={height}
        radius={999}
        style={{flex: 1, marginLeft: index === 0 ? 0 : gap}}
      />
    ))}
  </View>
);
