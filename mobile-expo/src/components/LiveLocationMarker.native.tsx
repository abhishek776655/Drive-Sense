import React, {useEffect, useRef} from 'react';
import {Animated, Easing, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';

type Props = {
  color: string;
  is3D?: boolean;
  headingDeg?: number;
};

export const LiveLocationMarker: React.FC<Props> = ({color, is3D = false, headingDeg = 0}) => {
  const pulse = useRef(new Animated.Value(0)).current;
  const strongBlue = '#1D4ED8';
  const deepBlue = '#FFFFFF';
  const haloBlue = 'rgba(59,130,246,0.24)';
  const haloBorder = 'rgba(255,255,255,0.82)';

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1.8],
  });

  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0],
  });

  return (
    <View style={{width: 56, height: 56, alignItems: 'center', justifyContent: 'center'}}>
      <Animated.View
        style={{
          position: 'absolute',
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: haloBlue,
          borderWidth: 1,
          borderColor: haloBorder,
          opacity: pulseOpacity,
          transform: [{scale: pulseScale}],
        }}
      />

      {is3D ? (
        <View
          style={{
            position: 'absolute',
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{rotate: `${headingDeg}deg`}],
          }}>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: deepBlue,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#0F172A',
              shadowOpacity: 0.18,
              shadowRadius: 14,
              shadowOffset: {width: 0, height: 8},
              elevation: 10,
              borderWidth: 1.5,
              borderColor: 'rgba(15,23,42,0.08)',
              }}>
            <MaterialCommunityIcons
              name="navigation-variant"
              size={22}
              color={strongBlue}
              style={{
                transform: [{translateY: -1}],
              }}
            />
          </View>
        </View>
      ) : (
        <View
          style={{
            position: 'absolute',
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: strongBlue,
            borderWidth: 3,
            borderColor: '#FFFFFF',
            shadowColor: '#0F172A',
            shadowOpacity: 0.16,
            shadowRadius: 10,
            shadowOffset: {width: 0, height: 6},
            elevation: 6,
          }}
        />
      )}
    </View>
  );
};
