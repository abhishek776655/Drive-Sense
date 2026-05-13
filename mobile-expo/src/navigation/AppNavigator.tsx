import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {MainTabs} from './MainTabs';

export const AppNavigator: React.FC = () => (
  <NavigationContainer>
    <MainTabs />
  </NavigationContainer>
);