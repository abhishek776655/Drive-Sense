import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {MapScreen} from '../screens/MapScreen';
import {MapStackParamList} from './types';

const Stack = createNativeStackNavigator<MapStackParamList>();

export const MapStack: React.FC = () => (
  <Stack.Navigator screenOptions={{headerShown: false}}>
    <Stack.Screen name="LiveTrackingMain" component={MapScreen} />
  </Stack.Navigator>
);
