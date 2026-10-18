import {Ionicons} from '@expo/vector-icons';
import {View} from 'react-native';
import {useAppTheme} from '../../theme/ThemeProvider';
import type {EventKind} from '../../utils/tripEvents';

type IconName = keyof typeof Ionicons.glyphMap;

export const EVENT_ICON: Record<EventKind, IconName> = {
  rapid_acceleration: 'flash',
  harsh_brake: 'hand-left',
  overspeed: 'speedometer',
  sharp_turn: 'return-up-forward',
};

export const useEventColor = () => {
  const {colors} = useAppTheme();
  return (kind: EventKind) => (kind === 'harsh_brake' ? colors.red : kind === 'overspeed' ? colors.blue : kind === 'sharp_turn' ? colors.purple : colors.amber);
};

/** Small round pin for a driving event on a map. */
export function EventMarker({kind}: {kind: EventKind}) {
  const theme = useAppTheme();
  const color = useEventColor()(kind);
  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: color,
        borderWidth: 2,
        borderColor: theme.colors.onAccent,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Ionicons name={EVENT_ICON[kind]} size={12} color={theme.colors.onAccent} />
    </View>
  );
}
