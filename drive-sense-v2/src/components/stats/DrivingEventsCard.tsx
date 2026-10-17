import {Ionicons} from '@expo/vector-icons';
import {View} from 'react-native';
import {useUnits} from '../../hooks/useUnits';
import type {StatsOverview} from '../../services/statsService';
import {withAlpha} from '../../theme/color';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {Card} from '../Card';

type IconName = keyof typeof Ionicons.glyphMap;

const KM_PER_MILE = 1.609344;

/** Harsh braking, rapid acceleration and speeding in the period, and all three per 100 km (or mi). */
export function DrivingEventsCard({events}: {events: NonNullable<StatsOverview['events']>}) {
  const c = useAppTheme().colors;
  const {units, distanceUnit} = useUnits();
  const cells: {icon: IconName; color: string; label: string; value: number}[] = [
    {icon: 'hand-left', color: c.red, label: 'Harsh braking', value: events.harsh_brake},
    {icon: 'flash', color: c.amber, label: 'Rapid accel', value: events.rapid_acceleration},
    {icon: 'speedometer', color: c.accent, label: 'Speeding', value: events.overspeed},
  ];
  const rate = events.per_100km == null ? null : units === 'imperial' ? events.per_100km * KM_PER_MILE : events.per_100km;
  return (
    <Card style={{padding: 16, gap: 14}}>
      <View style={{flexDirection: 'row', gap: 8}}>
        {cells.map((cell) => (
          <View key={cell.label} style={{flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 18, backgroundColor: withAlpha(cell.color, 0.1)}}>
            <Ionicons name={cell.icon} size={17} color={cell.color} />
            <AppText size={24} weight="black">
              {cell.value}
            </AppText>
            <AppText size={11} weight="bold" tone="secondary">
              {cell.label}
            </AppText>
          </View>
        ))}
      </View>
      <View style={{flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6}}>
        <AppText size={20} weight="black">
          {rate == null ? '–' : rate.toFixed(1)}
        </AppText>
        <AppText size={13} weight="bold" tone="secondary">
          events per 100 {distanceUnit}
        </AppText>
      </View>
    </Card>
  );
}
