import {
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
  useFonts,
} from '@expo-google-fonts/nunito';
import {Stack} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import {StatusBar} from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import {useEffect, useState} from 'react';
import {BrandIntro} from '../components/brand/BrandIntro';
import {useAuthStore} from '../stores/authStore';
import {useBrandIntroStore} from '../stores/brandIntroStore';
import {hydrateRecording} from '../stores/recordingPersistence';
// Registers the OS background-location task at startup, before any screen mounts.
import '../tracking/backgroundLocation';
// Creates the Bluetooth manager at startup when an adapter is paired (iOS relaunch for the adapter).
import '../obd/bleLaunch';
import {useDriveSettingsStore} from '../stores/driveSettingsStore';
import {usePreferencesStore} from '../stores/preferencesStore';
import {useAppearanceStore} from '../theme/appearanceStore';
import {ThemeProvider, useAppTheme} from '../theme/ThemeProvider';
import {startDriveNotifications} from '../notifications/driveNotifications';
import {startDriveRecorder} from '../sync/driveRecorder';
import {usePhoneUseFeed} from '../tracking/usePhoneUseFeed';
import {startObdRecorder} from '../sync/obdRecorder';
import {startSensorRecorder} from '../sync/sensorRecorder';
import {CLUSTER_INK} from '../cluster/accents';
import {startSync} from '../sync/syncEngine';
import {startDriveActivitySync} from '../widgets/driveActivitySync';
import {startWeekWidgetSync} from '../widgets/weekWidgetSync';

void SplashScreen.preventAutoHideAsync();

function RootStack() {
  // Phone use while driving is counted across every screen, so it lives at the root.
  usePhoneUseFeed();
  const theme = useAppTheme();
  const status = useAuthStore((s) => s.status);
  const signedIn = status === 'signedIn';
  // A new account is signed in but sent through onboarding until it accepts the safety terms.
  const onboarded = useAuthStore((s) => s.onboarded);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.colors.canvas);
  }, [theme.colors.canvas]);

  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{headerShown: false, orientation: 'portrait', contentStyle: {backgroundColor: theme.colors.canvas}}}>
        <Stack.Protected guard={signedIn && !onboarded}>
          <Stack.Screen name="onboarding" options={{animation: 'fade', contentStyle: {backgroundColor: theme.colors.accent}}} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && onboarded}>
          <Stack.Screen name="(tabs)" />
          {/* Rovy: Settings slides up as a sheet from the gear, swiped down or ✕ to close. */}
          <Stack.Screen name="settings" options={{presentation: 'modal', contentStyle: {backgroundColor: theme.colors.canvas}}} />
          {/* Slides up as a sheet from Home, like Settings. */}
          <Stack.Screen name="all-stats" options={{presentation: 'modal', contentStyle: {backgroundColor: theme.colors.canvas}}} />
          {/* Rovy: the drive opens as a sheet sliding up over the Logbook, swiped down to close. */}
          <Stack.Screen name="trip/[id]" options={{presentation: 'modal', contentStyle: {backgroundColor: theme.colors.canvas}}} />
          <Stack.Screen name="trip-summary" options={{presentation: 'fullScreenModal', gestureEnabled: false}} />
          {/* Cluster mode: the one landscape screen (spec 2026-10-25, cluster mode). */}
          <Stack.Screen name="cluster" options={{presentation: 'fullScreenModal', orientation: 'landscape', animation: 'fade', contentStyle: {backgroundColor: CLUSTER_INK.background}}} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black});
  const authStatus = useAuthStore((s) => s.status);
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const appearanceHydrated = useAppearanceStore((s) => s.hydrated);
  const hydrateAppearance = useAppearanceStore((s) => s.hydrate);
  const hydrateDriveSettings = useDriveSettingsStore((s) => s.hydrate);
  const preferencesHydrated = usePreferencesStore((s) => s.hydrated);
  const hydratePreferences = usePreferencesStore((s) => s.hydrate);
  const [recordingHydrated, setRecordingHydrated] = useState(false);
  const introHydrated = useBrandIntroStore((s) => s.hydrated);
  const introSeen = useBrandIntroStore((s) => s.seen);
  const hydrateIntro = useBrandIntroStore((s) => s.hydrate);
  const markIntroSeen = useBrandIntroStore((s) => s.markSeen);

  useEffect(() => {
    void bootstrap();
    void hydrateAppearance();
    void hydrateDriveSettings();
    void hydratePreferences();
    void hydrateIntro();
    void hydrateRecording().then(() => setRecordingHydrated(true));
  }, [bootstrap, hydrateAppearance, hydrateDriveSettings, hydratePreferences, hydrateIntro]);

  const ready = fontsLoaded && appearanceHydrated && preferencesHydrated && recordingHydrated && introHydrated && authStatus !== 'checking';

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  // Live Activity and week widget (iOS dev builds; no-ops elsewhere). Started once the recording is
  // restored, so a drive still running after a relaunch keeps its Live Activity.
  useEffect(() => {
    if (!ready) {
      return;
    }
    const stopActivity = startDriveActivitySync();
    const stopWidget = startWeekWidgetSync();
    const stopNotifications = startDriveNotifications();
    // The phone's copy of drives and vehicles (spec 2026-10-17, local-first part 1).
    const stopSync = startSync();
    // Every fix of a drive, kept so the drive is scored whole when it ends (part 2b).
    const stopRecorder = startDriveRecorder();
    // Each second of OBD-II data while a drive records (spec 2026-10-25, telemetry).
    const stopObdRecorder = startObdRecorder();
    // The phone's own sensors: corners, road and phone use per drive (telemetry sources, step 5).
    const stopSensorRecorder = startSensorRecorder();
    return () => {
      stopSync();
      stopRecorder();
      stopObdRecorder();
      stopSensorRecorder();
      stopActivity();
      stopWidget();
      stopNotifications();
    };
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <ThemeProvider>
      <RootStack />
      {/* First launch only: the splash hands off to the animated brand intro. */}
      {introSeen ? null : <BrandIntro onDone={markIntroSeen} />}
    </ThemeProvider>
  );
}
