import {useState} from 'react';
import {Pressable, View} from 'react-native';
import {useAppTheme} from '../../theme/ThemeProvider';
import {formatSpan} from '../../utils/format';
import {stopSummary, type Stop} from '../../utils/tripAnalysis';
import {AppText} from '../AppText';
import {Card} from '../Card';
import {clockTime} from './timeOfDay';

const COLLAPSED = 3;

/** Stops during the drive; tapping one shows it on the full-screen map. */
export function StopsCard({stops, onSelect}: {stops: Stop[]; onSelect: (stop: Stop) => void}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const [all, setAll] = useState(false);
  if (stops.length === 0) {
    return null;
  }
  const total = stops.reduce((sum, s) => sum + s.durationS, 0);
  const summary = stopSummary(stops);
  const shown = all ? stops : stops.slice(0, COLLAPSED);
  return (
    <Card style={{padding: 12, gap: 6}}>
      {summary && stops.length > 1 ? (
        <View style={{flexDirection: 'row', paddingHorizontal: 10, paddingTop: 4, paddingBottom: 2, gap: 18}}>
          <AppText size={12} weight="bold" tone="secondary">
            Longest <AppText size={13} weight="black">{formatSpan(summary.longestS)}</AppText>
          </AppText>
          <AppText size={12} weight="bold" tone="secondary">
            Average <AppText size={13} weight="black">{formatSpan(summary.averageS)}</AppText>
          </AppText>
        </View>
      ) : null}
      {shown.map((stop, i) => (
        <Pressable
          key={stop.startedAt}
          accessibilityRole="button"
          accessibilityLabel={`Stop at ${clockTime(stop.startedAt)}, ${formatSpan(stop.durationS)}. Show on map`}
          onPress={() => onSelect(stop)}
          style={({pressed}) => ({flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, backgroundColor: pressed ? c.control : undefined})}>
          <View style={{width: 26, height: 26, borderRadius: 13, backgroundColor: c.control, alignItems: 'center', justifyContent: 'center'}}>
            <AppText size={12} weight="black" tone="secondary">
              {i + 1}
            </AppText>
          </View>
          <AppText size={15} weight="bold" style={{flex: 1}}>
            {clockTime(stop.startedAt)}
          </AppText>
          <AppText size={16} weight="black">
            {formatSpan(stop.durationS)}
          </AppText>
        </Pressable>
      ))}
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingTop: 4}}>
        <AppText size={12} weight="semibold" tone="secondary">
          {stops.length} {stops.length === 1 ? 'stop' : 'stops'} · {formatSpan(total)} total
        </AppText>
        {stops.length > COLLAPSED ? (
          <Pressable accessibilityRole="button" onPress={() => setAll((v) => !v)} hitSlop={8}>
            <AppText size={13} weight="extrabold" tone="accent">
              {all ? 'Show less' : `Show all ${stops.length}`}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}
