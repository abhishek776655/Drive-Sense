import {Ionicons, MaterialCommunityIcons} from '@expo/vector-icons';
import {View} from 'react-native';
import {useAppTheme} from '../../theme/ThemeProvider';

/** Start: green disc with a flag. */
export function StartFlag() {
  const theme = useAppTheme();
  return (
    <View style={{width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.green, borderWidth: 3, borderColor: theme.colors.onAccent, alignItems: 'center', justifyContent: 'center'}}>
      <Ionicons name="flag-outline" size={13} color={theme.colors.onAccent} />
    </View>
  );
}

/** Destination: red disc with a white checkered flag, as in Rovy. */
export function FinishFlag() {
  const theme = useAppTheme();
  return (
    <View style={{width: 30, height: 30, borderRadius: 15, backgroundColor: theme.colors.red, borderWidth: 3, borderColor: theme.colors.onAccent, alignItems: 'center', justifyContent: 'center'}}>
      <MaterialCommunityIcons name="flag-checkered" size={15} color={theme.colors.onAccent} />
    </View>
  );
}

/** The car during a replay: accent disc with an arrow pointing the way it is heading. */
export function CarMarker({heading}: {heading: number | null}) {
  const theme = useAppTheme();
  return (
    <View style={{width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.accent, borderWidth: 3, borderColor: theme.colors.onAccent, alignItems: 'center', justifyContent: 'center'}}>
      <MaterialCommunityIcons name="navigation" size={18} color={theme.colors.onAccent} style={{transform: [{rotate: `${heading ?? 0}deg`}]}} />
    </View>
  );
}
