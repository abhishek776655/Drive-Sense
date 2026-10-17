import {View} from 'react-native';
import Svg, {Rect} from 'react-native-svg';
import {useUnits} from '../hooks/useUnits';
import type {TrendDay} from '../services/homeService';
import {useAppTheme} from '../theme/ThemeProvider';
import {AppText} from './AppText';
import {Card} from './Card';

/** Distance bars from `/dashboard/trend`. The latest bucket is the accent bar. */
export function TrendChart({days, title = 'Distance trend'}: {days: TrendDay[]; title?: string}) {
  const theme = useAppTheme();
  const u = useUnits();
  const max = Math.max(1, ...days.map((d) => d.distanceKm));
  const total = days.reduce((sum, d) => sum + d.distanceKm, 0);
  const H = 90;
  return (
    <Card style={{padding: 16}}>
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline'}}>
        <AppText size={13} weight="bold" tone="secondary">
          {title}
        </AppText>
        <AppText size={13} weight="extrabold">
          {(u.distanceValue(total * 1000) ?? 0).toFixed(1)} <AppText size={11} weight="semibold" tone="secondary">{u.distanceUnit}</AppText>
        </AppText>
      </View>
      <View style={{flexDirection: 'row', marginTop: 12, gap: 6}}>
        {days.map((day, i) => {
          const h = Math.max(4, (day.distanceKm / max) * H);
          const last = i === days.length - 1;
          return (
            <View key={day.key} style={{flex: 1, alignItems: 'center', gap: 6}}>
              <Svg width="100%" height={H}>
                <Rect
                  x="15%"
                  y={H - h}
                  width="70%"
                  height={h}
                  rx={5}
                  fill={last ? theme.colors.accent : theme.colors.textTertiary}
                  fillOpacity={day.distanceKm > 0 ? 1 : 0.35}
                />
              </Svg>
              <AppText size={11} weight="bold" tone="secondary">
                {day.label}
              </AppText>
            </View>
          );
        })}
      </View>
    </Card>
  );
}
