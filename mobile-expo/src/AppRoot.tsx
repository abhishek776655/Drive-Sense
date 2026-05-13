import React, {useEffect, useState} from 'react';
import {ActivityIndicator, View} from 'react-native';
import {useFonts} from 'expo-font';
import {
  Nunito_500Medium,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import {LoginScreen} from './screens/LoginScreen';
import {authService, setAuthExpiredHandler} from './services/apiClient';
import {getAppTheme} from './theme/appTheme';
import {AppNavigator} from './navigation';

export default function AppRoot() {
  const [fontsLoaded] = useFonts({
    Nunito_500Medium,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const theme = getAppTheme(false);

  useEffect(() => {
    setAuthExpiredHandler((message) => {
      setAuthMessage(message);
      setIsAuthenticated(false);
      setAuthChecked(true);
    });

    const bootstrapAuth = async () => {
      try {
        const token = await authService.getToken();
        if (!token) {
          setIsAuthenticated(false);
          return;
        }

        await authService.me();
        setIsAuthenticated(true);
      } catch {
        await authService.logout();
        setIsAuthenticated(false);
      } finally {
        setAuthChecked(true);
      }
    };

    void bootstrapAuth();

    return () => {
      setAuthExpiredHandler(null);
    };
  }, []);

  if (!fontsLoaded || !authChecked) {
    return (
      <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.screen}}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginScreen
        initialError={authMessage}
        onLoginSuccess={() => {
          setAuthMessage('');
          setIsAuthenticated(true);
        }}
      />
    );
  }

  return <AppNavigator />;
}
