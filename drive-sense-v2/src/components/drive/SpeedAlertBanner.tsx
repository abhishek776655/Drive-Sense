import {Ionicons} from '@expo/vector-icons';
import {View} from 'react-native';
import {useUnits} from '../../hooks/useUnits';
import {usePreferencesStore} from '../../stores/preferencesStore';
import {useRecordingStore} from '../../stores/recordingStore';
import {useAppTheme} from '../../theme/ThemeProvider';
import {kmhInUnits} from '../../utils/units';
import {AppText} from '../AppText';

/** Red strip on the Drive screen while the speed is over the Settings limit (it also vibrates). */
export function SpeedAlertBanner() {
  const c = useAppTheme().colors;
  const {units, speedUnit} = useUnits();
  const enabled = usePreferencesStore((s) => s.speedAlert);
  const limitKmh = usePreferencesStore((s) => s.speedAlertKmh);
  const over = useRecordingStore((s) => s.speedAlert.over && s.status === 'recording');
  if (!enabled || !over) {
    return null;
  }
  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel={`Over ${kmhInUnits(limitKmh, units)} ${speedUnit}`}
      style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.red, borderRadius: 99, paddingVertical: 8, paddingHorizontal: 16, alignSelf: 'center'}}>
      <Ionicons name="warning" size={16} color={c.onAccent} />
      <AppText size={14} weight="black" tone="onAccent">
        Over {kmhInUnits(limitKmh, units)} {speedUnit}
      </AppText>
    </View>
  );
}
