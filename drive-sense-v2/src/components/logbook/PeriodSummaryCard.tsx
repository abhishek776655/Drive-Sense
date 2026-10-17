import {Ionicons} from '@expo/vector-icons';
import type {ReactNode} from 'react';
import {View} from 'react-native';
import {useUnits} from '../../hooks/useUnits';
import type {TripListTotals} from '../../services/tripService';
import {useAppTheme} from '../../theme/ThemeProvider';
import {formatDuration} from '../../utils/format';
import {AppText} from '../AppText';
import {Card} from '../Card';
import {TabIcon} from '../TabIcons';

/** Rovy's summary: icon on the left, big value with a small caps label under it, three columns. */
export function PeriodSummaryCard({totals}: {totals: TripListTotals}) {
  const c = useAppTheme().colors;
  const u = useUnits();
  const cells: {icon: ReactNode; value: string; label: string}[] = [
    {icon: <TabIcon name="route" color={c.accent} size={18} />, value: String(totals.count), label: 'DRIVES'},
    {icon: <Ionicons name="map" size={17} color={c.amber} />, value: u.distance(totals.distance_meters), label: `TOTAL ${u.distanceUnit.toUpperCase()}`},
    {icon: <Ionicons name="stopwatch" size={17} color={c.accent} />, value: formatDuration(totals.duration_seconds), label: 'TIME'},
  ];
  return (
    <Card style={{flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 8, borderRadius: 26}}>
      {cells.map((cell, i) => (
        <View key={cell.label} style={{flex: i === 2 ? 1.3 : 1, flexDirection: 'row'}}>
          {i > 0 ? <View style={{width: 1.5, marginVertical: 4, borderRadius: 1, backgroundColor: c.separator}} /> : null}
          <View style={{flex: 1, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 8, paddingHorizontal: 4}}>
            <View style={{paddingTop: 4}}>{cell.icon}</View>
            <View style={{flexShrink: 1}}>
              <AppText size={22} weight="extrabold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{lineHeight: 27}}>
                {cell.value}
              </AppText>
              <AppText size={10} weight="bold" tone="tertiary" style={{letterSpacing: 1}}>
                {cell.label}
              </AppText>
            </View>
          </View>
        </View>
      ))}
    </Card>
  );
}
