import {Stack} from 'expo-router';
import {useAppTheme} from '../../theme/ThemeProvider';

export const unstable_settings = {initialRouteName: 'welcome'};

export default function AuthLayout() {
  const theme = useAppTheme();
  return (
    <Stack screenOptions={{headerShown: false, contentStyle: {backgroundColor: theme.colors.canvas}}}>
      {/* Welcome and sign-up sit on the accent; fading between them keeps the orange continuous. */}
      <Stack.Screen name="welcome" options={{contentStyle: {backgroundColor: theme.colors.accent}}} />
      <Stack.Screen name="signup" options={{animation: 'fade', contentStyle: {backgroundColor: theme.colors.accent}}} />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
