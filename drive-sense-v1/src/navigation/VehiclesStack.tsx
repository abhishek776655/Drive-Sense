import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {VehiclesScreen} from '../screens/VehiclesScreen';
import {AddVehicleScreen} from '../screens/AddVehicleScreen';
import {VehicleAnalyticsScreen} from '../screens/VehicleAnalyticsScreen';
import {VehiclesStackParamList} from './types';

const Stack = createNativeStackNavigator<VehiclesStackParamList>();

export const VehiclesStack: React.FC = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
    }}>
    <Stack.Screen name="VehicleList" component={VehiclesScreen} />
    <Stack.Screen name="AddVehicle" component={AddVehicleScreen} />
    <Stack.Screen name="VehicleAnalytics" component={VehicleAnalyticsScreen} />
  </Stack.Navigator>
);
