import {Stack} from 'expo-router';
import {useAppTheme} from '../../theme/ThemeProvider';

/**
 * Settings is a sheet (see the root layout); its pages draw their own headers. Profile and Edit
 * Profile stack as further sheets on top, as in Rovy.
 */
export default function SettingsLayout() {
  const theme = useAppTheme();
  const contentStyle = {backgroundColor: theme.colors.canvas};
  return (
    <Stack screenOptions={{headerShown: false, contentStyle}}>
      <Stack.Screen name="index" />
      <Stack.Screen name="profile" options={{presentation: 'modal', contentStyle}} />
      <Stack.Screen name="edit-profile" options={{presentation: 'modal', contentStyle}} />
      <Stack.Screen name="achievements" options={{presentation: 'modal', contentStyle}} />
    </Stack>
  );
}
