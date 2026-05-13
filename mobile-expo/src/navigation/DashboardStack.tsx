import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {DashboardScreen} from '../screens/DashboardScreen';
import {DashboardStackParamList} from './types';

const Stack = createNativeStackNavigator<DashboardStackParamList>();

export const DashboardStack: React.FC = () => (
  <Stack.Navigator screenOptions={{headerShown: false}}>
    <Stack.Screen name="DashboardMain" component={DashboardScreen} />
  </Stack.Navigator>
);
