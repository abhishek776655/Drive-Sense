import {Ionicons} from '@expo/vector-icons';
import {View} from 'react-native';
import type {StatsOverview} from '../../services/statsService';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {Card} from '../Card';

type IconName = keyof typeof Ionicons.glyphMap;

const PART_ICONS: Record<string, IconName> = {Morning: 'partly-sunny', Afternoon: 'sunny', Evening: 'cloudy-night', Night: 'moon'};
const DAY_HEIGHT = 64;

/** When the user drives: drives by part of the day, then by weekday. */
export function WhenYouDriveCard({parts, days}: {parts: StatsOverview['time_of_day']; days: StatsOverview['weekdays']}) {
  const c = useAppTheme().colors;
  const total = parts.reduce((sum, p) => sum + p.trips, 0);
  const busiestDay = Math.max(1, ...days.map((d) => d.trips));
  const top = parts.reduce((best, p) => (p.trips > best.trips ? p : best), parts[0]);
  return (
    <Card style={{padding: 16, gap: 16}}>
      {total > 0 && top ? (
        <AppText size={13} weight="bold" tone="secondary">
          Mostly in the <AppText size={13} weight="black">{top.label.toLowerCase()}</AppText> · {Math.round((top.trips / total) * 100)}% of drives
        </AppText>
      ) : null}
      <View style={{gap: 10}}>
        {parts.map((part) => {
          const share = total > 0 ? part.trips / total : 0;
          return (
            <View key={part.label} style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
              <Ionicons name={PART_ICONS[part.label] ?? 'time'} size={16} color={c.accent} />
              <AppText size={13} weight="extrabold" style={{width: 74}}>
                {part.label}
              </AppText>
              <View style={{flex: 1, height: 10, borderRadius: 5, backgroundColor: c.canvas, overflow: 'hidden'}}>
                <View style={{width: `${share * 100}%`, height: '100%', borderRadius: 5, backgroundColor: c.accent}} />
              </View>
              <AppText size={12} weight="bold" tone="secondary" style={{width: 34, textAlign: 'right'}}>
                {part.trips}
              </AppText>
            </View>
          );
        })}
      </View>
      <View style={{flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: DAY_HEIGHT + 34}}>
        {days.map((day) => {
          const busiest = day.trips === busiestDay && day.trips > 0;
          return (
            <View key={day.label} style={{flex: 1, alignItems: 'center', gap: 4}}>
              <AppText size={11} weight="black" tone={day.trips > 0 ? 'primary' : 'tertiary'}>
                {day.trips}
              </AppText>
              <View style={{alignSelf: 'stretch', height: Math.max(4, (day.trips / busiestDay) * DAY_HEIGHT), borderRadius: 6, backgroundColor: busiest ? c.accent : c.separator}} />
              <AppText size={10} weight="bold" tone={busiest ? 'accent' : 'tertiary'}>
                {day.label}
              </AppText>
            </View>
          );
        })}
      </View>
    </Card>
  );
}
