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
import {RegisterScreen} from './screens/RegisterScreen';
import {OnboardingScreen} from './screens/OnboardingScreen';
import {authService, setAuthExpiredHandler} from './services/apiClient';
import {vehicleService} from './services/vehicleService';
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
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  /** `null` until we know whether this account has a vehicle; `true` sends them to onboarding. */
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const theme = useAppTheme();

  /**
   * An account with no vehicle can do nothing useful: no trips, no scores, no garage. Rather than
   * dropping someone into a dashboard of dashes, route them to onboarding first. A failed lookup
   * deliberately resolves to "no onboarding" — a network blip must not block the whole app.
   */
  const resolveOnboarding = async () => {
    try {
      const vehicles = await vehicleService.listVehicles();
      setNeedsOnboarding(vehicles.length === 0);
    } catch {
      setNeedsOnboarding(false);
    }
  };

  useEffect(() => {
    setAuthExpiredHandler((message) => {
      setAuthMessage(message);
      setIsAuthenticated(false);
      setAuthChecked(true);
      // Signing out lands on sign-in, never on sign-up: the account already exists. Without this
      // the view stuck wherever it was last, so logging out after visiting sign-up reopened it.
      setAuthView('login');
      // Force a fresh vehicle check on the next sign-in rather than trusting the last account's.
      setNeedsOnboarding(null);
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
        await resolveOnboarding();
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
    if (authView === 'register') {
      return (
        <RegisterScreen
          onRegisterSuccess={() => {
            setAuthMessage('');
            setIsAuthenticated(true);
            // A brand-new account has no vehicle, so skip the lookup and go straight to onboarding.
            setNeedsOnboarding(true);
          }}
          onGoToLogin={() => setAuthView('login')}
        />
      );
    }

    return (
      <LoginScreen
        initialError={authMessage}
        onLoginSuccess={() => {
          setAuthMessage('');
          setIsAuthenticated(true);
          void resolveOnboarding();
        }}
        onGoToRegister={() => {
          setAuthMessage('');
          setAuthView('register');
        }}
      />
    );
  }

  // Hold the spinner rather than flashing the dashboard before the vehicle check resolves.
  if (needsOnboarding === null) {
    return (
      <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.screen}}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (needsOnboarding) {
    return <OnboardingScreen onDone={() => setNeedsOnboarding(false)} />;
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
