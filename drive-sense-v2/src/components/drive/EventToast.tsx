import {Ionicons} from '@expo/vector-icons';
import {useEffect, useState} from 'react';
import {View} from 'react-native';
import type {DriveEventKind} from '../../stores/recordingStore';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';

const LABELS: Record<DriveEventKind, {text: string; icon: keyof typeof Ionicons.glyphMap}> = {
  rapid_acceleration: {text: 'Rapid acceleration', icon: 'flash'},
  harsh_brake: {text: 'Harsh brake', icon: 'hand-left'},
  overspeed: {text: 'Overspeed', icon: 'speedometer'},
};

const VISIBLE_MS = 3000;

/** Short-lived event toast under the top bar. */
export function EventToast({event}: {event: {kind: DriveEventKind; at: number} | null}) {
  const theme = useAppTheme();
  // Each event is keyed by its timestamp; the toast hides once that event's timer has fired.
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  useEffect(() => {
    if (!event) {
      return;
    }
    const id = setTimeout(() => setDismissedAt(event.at), VISIBLE_MS);
    return () => clearTimeout(id);
  }, [event]);
  if (!event || dismissedAt === event.at) {
    return null;
  }
  const label = LABELS[event.kind];
  // Dark ink on amber in both appearances: canvas is black in dark, text is black in light.
  const ink = theme.scheme === 'dark' ? theme.colors.canvas : theme.colors.textPrimary;
  return (
    <View style={{alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.amber, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6}}>
      <Ionicons name={label.icon} size={13} color={ink} />
      <AppText size={12} weight="black" color={ink}>
        {label.text}
      </AppText>
    </View>
  );
}
