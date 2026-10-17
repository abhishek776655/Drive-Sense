import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {TripsListScreen} from '../screens/TripsListScreen';
import {TripDetailsScreen} from '../screens/TripDetailsScreen';
import {TripsStackParamList} from './types';

const Stack = createNativeStackNavigator<TripsStackParamList>();

export const TripsStack: React.FC = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: {backgroundColor: '#0a0a0a'},
      headerTintColor: '#fff',
      headerTitleStyle: {fontWeight: '600'},
      headerShadowVisible: false,
    }}>
    <Stack.Screen name="TripsList" component={TripsListScreen} options={{headerShown: false}} />
    <Stack.Screen name="TripDetails" component={TripDetailsScreen} options={{headerShown: false}} />
  </Stack.Navigator>
);
