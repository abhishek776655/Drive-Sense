import React, {useEffect, useState} from 'react';
import {ActivityIndicator, View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {useFonts} from 'expo-font';
import {
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import {LoginScreen} from './screens/LoginScreen';
import {authService, setAuthExpiredHandler} from './services/apiClient';
import {useUserStore, type CurrentUser} from './store/userStore';
import {ThemeProvider, useAppTheme} from './theme/appTheme';
import {AppNavigator} from './navigation';

const AppRootContent: React.FC = () => {
  const [fontsLoaded] = useFonts({
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const theme = useAppTheme();

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

        // Boot already verifies the token by fetching the user; keep the result instead of
        // discarding it so the profile surfaces have an identity without a second request.
        useUserStore.setState({user: (await authService.me()) as CurrentUser, loading: false, error: null});
        setIsAuthenticated(true);
      } catch {
        await authService.logout();
        useUserStore.getState().clear();
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
};

export default function AppRoot() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppRootContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
