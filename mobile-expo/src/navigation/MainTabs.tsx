import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {DashboardStack} from './DashboardStack';
import {TripsStack} from './TripsStack';
import {MapStack} from './MapStack';
import {VehiclesStack} from './VehiclesStack';
import {ProfileStack} from './ProfileStack';
import {CustomTabBar} from './CustomTabBar';

const Tab = createBottomTabNavigator();

export const MainTabs: React.FC = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarShowLabel: false,
    }}
    tabBar={(props) => <CustomTabBar {...props} />}>
    <Tab.Screen name="DashboardStack" component={DashboardStack} />
    <Tab.Screen name="TripsStack" component={TripsStack} />
    <Tab.Screen name="MapStack" component={MapStack} />
    <Tab.Screen name="VehiclesStack" component={VehiclesStack} />
    <Tab.Screen name="ProfileStack" component={ProfileStack} />
  </Tab.Navigator>
);
