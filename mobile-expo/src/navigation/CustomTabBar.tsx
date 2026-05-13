import React from 'react';
import {StyleSheet, View, useColorScheme} from 'react-native';
import {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {AnimatedTabButton} from './AnimatedTabButton';

const TAB_CONFIG = [
  {name: 'DashboardStack', label: 'Home', activeIcon: 'home', inactiveIcon: 'home-outline'},
  {name: 'TripsStack', label: 'Trips', activeIcon: 'car', inactiveIcon: 'car-outline'},
  {name: 'MapStack', label: 'Live', activeIcon: 'pulse', inactiveIcon: 'pulse-outline', center: true},
  {name: 'VehiclesStack', label: 'Garage', activeIcon: 'car-sport', inactiveIcon: 'car-sport-outline'},
  {name: 'ProfileStack', label: 'Profile', activeIcon: 'person', inactiveIcon: 'person-outline'},
];

export const CustomTabBar: React.FC<BottomTabBarProps> = ({state, navigation}) => {
  const currentRoute = state.routes[state.index];
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View
      style={[
        styles.tabBar,
        {
          backgroundColor: isDark ? '#0D1422' : 'rgba(255,255,255,0.96)',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
        },
      ]}>
      {TAB_CONFIG.map((tab) => (
        <AnimatedTabButton
          key={tab.name}
          label={tab.label}
          activeIcon={tab.activeIcon}
          inactiveIcon={tab.inactiveIcon}
          focused={currentRoute.name === tab.name}
          center={tab.center}
          onPress={() => {
            if (currentRoute.name !== tab.name) {
              navigation.navigate(tab.name);
            }
          }}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 22,
    left: 16,
    right: 16,
    height: 76,
    borderRadius: 28,
    paddingHorizontal: 8,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 1,
  },
});
