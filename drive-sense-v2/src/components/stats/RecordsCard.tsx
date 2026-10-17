import {Ionicons} from '@expo/vector-icons';
import {Pressable, View} from 'react-native';
import {useUnits} from '../../hooks/useUnits';
import type {RecordTrip, StatsOverview} from '../../services/statsService';
import {withAlpha} from '../../theme/color';
import {useAppTheme} from '../../theme/ThemeProvider';
import {formatDuration, formatInt} from '../../utils/format';
import {localDate} from '../../utils/stats';
import {AppText} from '../AppText';
import {Card} from '../Card';

type IconName = keyof typeof Ionicons.glyphMap;

const shortDate = (date: Date) => date.toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'});
const city = (address: string | null) => address?.split(',').pop()?.trim() || null;

/** Personal bests in the period (each opens its drive), then the three biggest driving days. */
export function RecordsCard({records, topDays, onOpenTrip}: {records: StatsOverview['records']; topDays: StatsOverview['top_days']; onOpenTrip: (id: string) => void}) {
  const c = useAppTheme().colors;
  const u = useUnits();
  const rows: {icon: IconName; color: string; label: string; record: RecordTrip | null; value: (n: number) => string}[] = [
    {icon: 'flash', color: c.accent, label: 'Top speed', record: records.top_speed, value: (n) => `${u.speed(n)} ${u.speedUnit}`},
    {icon: 'map', color: c.cyan, label: 'Longest drive', record: records.longest_distance, value: (n) => `${u.distance(n)} ${u.distanceUnit}`},
    {icon: 'hourglass', color: c.purple, label: 'Longest time', record: records.longest_duration, value: (n) => formatDuration(n)},
    {icon: 'ribbon', color: c.green, label: 'Best score', record: records.best_score, value: (n) => formatInt(n)},
  ];
  return (
    <Card style={{paddingVertical: 8, paddingHorizontal: 16, gap: 2}}>
      {rows.map((row) =>
        row.record ? (
          <Pressable
            key={row.label}
            accessibilityRole="button"
            accessibilityLabel={`${row.label}, ${row.value(row.record.value)}, open drive`}
            onPress={() => onOpenTrip(row.record!.trip_id)}
            style={({pressed}) => ({flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, opacity: pressed ? 0.6 : 1})}>
            <View style={{width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(row.color, 0.14)}}>
              <Ionicons name={row.icon} size={17} color={row.color} />
            </View>
            <View style={{flex: 1}}>
              <AppText size={14} weight="extrabold">
                {row.label}
              </AppText>
              <AppText size={12} weight="semibold" tone="secondary" numberOfLines={1}>
                {[shortDate(new Date(row.record.start_time)), city(row.record.end_address)].filter(Boolean).join(' · ')}
              </AppText>
            </View>
            <AppText size={16} weight="black">
              {row.value(row.record.value)}
            </AppText>
            <Ionicons name="chevron-forward" size={15} color={c.textTertiary} />
          </Pressable>
        ) : null,
      )}
      {topDays.length > 0 ? (
        <>
          <AppText size={11} weight="extrabold" tone="tertiary" style={{letterSpacing: 0.8, marginTop: 10, marginBottom: 2}}>
            TOP DRIVING DAYS
          </AppText>
          {topDays.map((day, i) => (
            <View key={day.date} style={{flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8}}>
              <AppText size={14} weight="black" tone="accent" style={{width: 22}}>
                {i + 1}
              </AppText>
              <AppText size={14} weight="bold" style={{flex: 1}}>
                {localDate(day.date).toLocaleDateString('en-IN', {weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'})}
              </AppText>
              <AppText size={12} weight="semibold" tone="secondary">
                {day.trip_count} {day.trip_count === 1 ? 'drive' : 'drives'}
              </AppText>
              <AppText size={15} weight="black" style={{minWidth: 64, textAlign: 'right'}}>
                {u.distance(day.distance_meters)}
                <AppText size={11} weight="bold" tone="secondary">
                  {' '}
                  {u.distanceUnit}
                </AppText>
              </AppText>
            </View>
          ))}
        </>
      ) : null}
    </Card>
  );
}
