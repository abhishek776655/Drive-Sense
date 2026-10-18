import {useState} from 'react';
import {Pressable, View} from 'react-native';
import {useUnits} from '../../hooks/useUnits';
import type {DriveShare} from '../../services/statsService';
import {withAlpha} from '../../theme/color';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {Card} from '../Card';

const CHART_HEIGHT = 150;
const WEEKEND = new Set(['Sat', 'Sun']);
/** Hours labelled under the hourly chart. */
const HOUR_TICKS = new Set(['00', '03', '06', '09', '12', '15', '18', '21']);

/** A light horizontal guide at a share (0..1) of the chart's height. */
function Guide({at, dashed, color}: {at: number; dashed?: boolean; color: string}) {
  return <View pointerEvents="none" style={{position: 'absolute', left: 0, right: 0, bottom: at * CHART_HEIGHT, borderTopWidth: 1, borderColor: color, borderStyle: dashed ? 'dashed' : 'solid'}} />;
}

type DayMetric = 'distance' | 'drives';

/**
 * Distance (or drives) by weekday over the period: one bar a day, weekends in the accent, the
 * busiest day labelled and a dashed line at the daily average.
 */
export function DistanceByDayCard({days}: {days: DriveShare[]}) {
  const c = useAppTheme().colors;
  const u = useUnits();
  const [metric, setMetric] = useState<DayMetric>('distance');
  const value = (d: DriveShare) => (metric === 'distance' ? (u.distanceValue(d.distance_meters) ?? 0) : d.trips);
  const values = days.map(value);
  const max = Math.max(...values, 0);
  const top = max > 0 ? max * 1.15 : 1;
  const average = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const peak = values.indexOf(max);
  const format = (n: number) => (metric === 'distance' ? n.toFixed(n >= 100 ? 0 : 1) : String(Math.round(n)));
  return (
    <Card style={{padding: 16, gap: 12}}>
      <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
        <AppText size={13} weight="bold" tone="secondary">
          {metric === 'distance' ? `Total distance by day (${u.distanceUnit})` : 'Drives by day'}
        </AppText>
        <View style={{flexDirection: 'row', gap: 4, padding: 3, borderRadius: 14, backgroundColor: c.control}}>
          {(['distance', 'drives'] as const).map((m) => (
            <Pressable
              key={m}
              accessibilityRole="button"
              accessibilityState={{selected: metric === m}}
              onPress={() => setMetric(m)}
              style={{paddingHorizontal: 10, paddingVertical: 4, borderRadius: 11, backgroundColor: metric === m ? c.card : 'transparent'}}>
              <AppText size={12} weight="extrabold" tone={metric === m ? undefined : 'secondary'}>
                {m === 'distance' ? 'Distance' : 'Drives'}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={{height: CHART_HEIGHT, flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 14}}>
        <Guide at={0} color={c.separator} />
        {average > 0 ? <Guide at={average / top} dashed color={withAlpha(c.textSecondary, 0.6)} /> : null}
        {days.map((d, i) => (
          <View key={d.label} style={{flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%'}}>
            {i === peak && max > 0 ? (
              <AppText size={12} weight="black" tone="secondary" style={{marginBottom: 4}}>
                {format(max)}
              </AppText>
            ) : null}
            <View
              style={{
                width: '100%',
                height: Math.max(values[i] > 0 ? 4 : 0, (values[i] / top) * CHART_HEIGHT),
                borderTopLeftRadius: 8,
                borderTopRightRadius: 8,
                backgroundColor: WEEKEND.has(d.label) ? c.accent : c.cyan,
              }}
            />
          </View>
        ))}
      </View>
      <View style={{flexDirection: 'row', gap: 8}}>
        {days.map((d) => (
          <AppText key={d.label} size={12} weight="bold" tone="secondary" style={{flex: 1, textAlign: 'center'}}>
            {d.label}
          </AppText>
        ))}
      </View>
      {average > 0 ? (
        <AppText size={12} weight="bold" tone="tertiary">
          Dashed line: average {format(average)}
          {metric === 'distance' ? ` ${u.distanceUnit}` : ' drives'} a day of the week
        </AppText>
      ) : null}
    </Card>
  );
}

/** Peak driving hours: drives started in each hour of the day over the period, the busiest labelled. */
export function PeakHoursCard({hours}: {hours: DriveShare[]}) {
  const c = useAppTheme().colors;
  const max = Math.max(...hours.map((h) => h.trips), 0);
  const top = max > 0 ? max * 1.15 : 1;
  const peak = hours.findIndex((h) => h.trips === max);
  return (
    <Card style={{padding: 16, gap: 12}}>
      <AppText size={13} weight="bold" tone="secondary">
        {max > 0 ? (
          <>
            Busiest at <AppText size={13} weight="black">{hours[peak].label}:00</AppText> · drives started by hour
          </>
        ) : (
          'Drives started by hour of day'
        )}
      </AppText>
      <View style={{height: CHART_HEIGHT, flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginTop: 14}}>
        <Guide at={0} color={c.separator} />
        <Guide at={0.5} dashed color={withAlpha(c.textTertiary, 0.4)} />
        {hours.map((h, i) => (
          <View key={h.label} style={{flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%'}}>
            {i === peak && max > 0 ? (
              <AppText size={11} weight="black" tone="secondary" style={{marginBottom: 3}}>
                {max}
              </AppText>
            ) : null}
            <View
              style={{
                width: '100%',
                height: Math.max(h.trips > 0 ? 3 : 0, (h.trips / top) * CHART_HEIGHT),
                borderTopLeftRadius: 3,
                borderTopRightRadius: 3,
                backgroundColor: i === peak ? c.cyan : withAlpha(c.cyan, 0.55),
              }}
            />
          </View>
        ))}
      </View>
      <View style={{flexDirection: 'row', gap: 3}}>
        {hours.map((h) => (
          <View key={h.label} style={{flex: 1, alignItems: 'center', overflow: 'visible'}}>
            {HOUR_TICKS.has(h.label) ? (
              <AppText size={10} weight="bold" tone="secondary" style={{width: 24, textAlign: 'center'}}>
                {h.label}
              </AppText>
            ) : null}
          </View>
        ))}
      </View>
    </Card>
  );
}
