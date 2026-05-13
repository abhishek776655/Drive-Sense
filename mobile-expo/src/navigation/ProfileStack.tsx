import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {ProfileScreen} from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator();

export const ProfileStack: React.FC = () => (
  <Stack.Navigator screenOptions={{headerShown: false}}>
    <Stack.Screen name="ProfileMain" component={ProfileScreen} />
  </Stack.Navigator>
);