import {router} from 'expo-router';
import {Pressable, View} from 'react-native';
import {useShallow} from 'zustand/react/shallow';
import {useNow} from '../hooks/useNow';
import {useUnits} from '../hooks/useUnits';
import {elapsedSeconds, useRecordingStore} from '../stores/recordingStore';
import {useAppTheme} from '../theme/ThemeProvider';
import {formatClock} from '../utils/format';
import {AppText} from './AppText';
import {Glass} from './Glass';
import {BANNER_HEIGHT} from './tabBarLayout';

/** Live drive on another tab: speed, clock and distance. Tapping returns to Drive. */
export function MiniRecordingBanner() {
  const theme = useAppTheme();
  const u = useUnits();
  const status = useRecordingStore((s) => s.status);
  const stats = useRecordingStore((s) => s.stats);
  const timing = useRecordingStore(
    useShallow((s) => ({startedAt: s.startedAt, pausedMs: s.pausedMs, pausedAt: s.pausedAt})),
  );
  const now = useNow(1000);
  const paused = status === 'paused';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Open live drive" onPress={() => router.navigate('/drive')}>
      <Glass style={{height: BANNER_HEIGHT}}>
        <View style={{flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 12}}>
          <View style={{width: 8, height: 8, borderRadius: 4, backgroundColor: paused ? theme.colors.amber : theme.colors.green}} />
          <AppText size={13} weight="extrabold" style={{flex: 1}}>
            {paused ? 'Paused' : 'Recording'} · {formatClock(elapsedSeconds(timing, now))}
          </AppText>
          <AppText size={13} weight="extrabold">
            {u.speed(stats.speedMps)} <AppText size={11} weight="semibold" tone="secondary">{u.speedUnit}</AppText>
          </AppText>
          <AppText size={13} weight="extrabold">
            {u.distance(stats.distanceM)} <AppText size={11} weight="semibold" tone="secondary">{u.distanceUnit}</AppText>
          </AppText>
        </View>
      </Glass>
    </Pressable>
  );
}
