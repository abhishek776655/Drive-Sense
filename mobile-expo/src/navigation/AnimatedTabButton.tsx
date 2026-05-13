import React from 'react';
import {StyleSheet, Text, TouchableOpacity} from 'react-native';
import Animated, {useAnimatedStyle, withSpring} from 'react-native-reanimated';
import {Ionicons} from '@expo/vector-icons';
import {useAppTheme} from '../theme/appTheme';

interface AnimatedTabButtonProps {
  label: string;
  activeIcon: string;
  inactiveIcon: string;
  focused: boolean;
  center?: boolean;
  onPress: () => void;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export const AnimatedTabButton: React.FC<AnimatedTabButtonProps> = ({
  label,
  activeIcon,
  inactiveIcon,
  focused,
  center = false,
  onPress,
}) => {
  const theme = useAppTheme();
  const activeColor = theme.accent;
  const inactiveColor = theme.textSubtle;

  const buttonAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const scale = withSpring(focused ? 1.08 : 1, {
      damping: 40,
      stiffness: 400,
      mass: 0.5,
    });
    return {
      transform: [{scale}],
    };
  }, [focused]);

  return (
    <AnimatedTouchable
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.tabButtonWrapper, center && styles.centerButtonWrapper, buttonAnimatedStyle]}>
      <Animated.View
        style={[
          styles.iconContainer,
          focused && styles.iconContainerActive,
          center && styles.centerIconContainer,
          center && focused && styles.centerIconContainerActive,
        ]}>
        <Ionicons
          name={focused ? (activeIcon as any) : (inactiveIcon as any)}
          size={center ? 24 : 22}
          color={center ? '#FFFFFF' : focused ? activeColor : inactiveColor}
        />
      </Animated.View>
      <Text
        style={[
          styles.label,
          focused && styles.labelActive,
          center && styles.centerLabel,
          center && focused && styles.centerLabelActive,
        ]}>
        {label}
      </Text>
    </AnimatedTouchable>
  );
};

const styles = StyleSheet.create({
  tabButtonWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
    paddingBottom: 2,
  },
  centerButtonWrapper: {
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 36,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  iconContainerActive: {
    backgroundColor: 'rgba(36, 107, 255, 0.12)',
  },
  centerIconContainer: {
    width: 52,
    height: 42,
    borderRadius: 18,
    backgroundColor: '#246BFF',
    shadowColor: '#246BFF',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 7,
  },
  centerIconContainerActive: {
    backgroundColor: '#1D4ED8',
  },
  label: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 3,
    fontWeight: '600',
  },
  labelActive: {
    color: '#246BFF',
    fontWeight: '700',
  },
  centerLabel: {
    marginTop: 3,
    color: '#64748B',
    fontWeight: '700',
  },
  centerLabelActive: {
    color: '#1D4ED8',
  },
});
