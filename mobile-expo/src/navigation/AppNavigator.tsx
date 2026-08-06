import React from 'react';
import {DarkTheme, DefaultTheme, NavigationContainer} from '@react-navigation/native';
import {useAppTheme} from '../theme/appTheme';
import {AppSidebarProvider} from '../components/AppSidebar';
import {MainTabs} from './MainTabs';

export const AppNavigator: React.FC = () => {
  const theme = useAppTheme();
  const navigationTheme = theme.dark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: theme.screen,
          card: theme.card,
          border: theme.cardBorder,
          primary: theme.accent,
          text: theme.text,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: theme.screen,
          card: theme.card,
          border: theme.cardBorder,
          primary: theme.accent,
          text: theme.text,
        },
      };

  return (
    <NavigationContainer theme={navigationTheme}>
      <AppSidebarProvider>
        <MainTabs />
      </AppSidebarProvider>
    </NavigationContainer>
  );
};
