import {useState} from 'react';
import {Pressable, ScrollView, View} from 'react-native';
import {useUnits} from '../../hooks/useUnits';
import type {StatsOverview, StatsPeriod} from '../../services/statsService';
import {withAlpha} from '../../theme/color';
import {useAppTheme} from '../../theme/ThemeProvider';
import {showAxisLabel, TREND_METRICS, trendAxisLabel, trendBucketTitle, trendTotal, type TrendMetric} from '../../utils/stats';
import {AppText} from '../AppText';
import {GlassButton} from '../GlassButton';
import {Card} from '../Card';

const CHART_HEIGHT = 130;

/** One trend chart with a metric switcher; bars follow the period. Tap a bar to read it. */
export function TrendCard({trend, period, periodTitle}: {trend: StatsOverview['trend']; period: StatsPeriod; periodTitle: string}) {
  const c = useAppTheme().colors;
  const {units} = useUnits();
  const [metric, setMetric] = useState<TrendMetric>('distance');
  const [picked, setPicked] = useState<number | null>(null);
  const def = TREND_METRICS.find((m) => m.value === metric) ?? TREND_METRICS[0];
  const values = trend.buckets.map((b) => def.read(b) ?? 0);
  const max = Math.max(...values, 0);
  // The period's total is read out until a bar is tapped (a stale pick from a longer period resets).
  const pick = picked != null && picked < trend.buckets.length ? picked : null;
  const selected = pick != null ? trend.buckets[pick] : null;
  const readout = def.format(selected ? def.read(selected) : trendTotal(metric, trend.buckets), units);
  const unit = def.unit(units);
  // With nothing tapped, the current day or month is the highlighted bar.
  const index = pick ?? trend.buckets.length - 1;

  return (
    <Card style={{padding: 16, gap: 14}}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginHorizontal: -16, marginVertical: -8}} contentContainerStyle={{paddingHorizontal: 16, paddingVertical: 8, gap: 6}}>
        {TREND_METRICS.map((m) => {
          const on = m.value === metric;
          return (
            <GlassButton
              key={m.value}
              accessibilityLabel={m.label}
              accessibilityState={{selected: on}}
              onPress={() => setMetric(m.value)}
              fill={on ? c.accent : undefined}
              style={{height: 32, paddingHorizontal: 13}}>
              <AppText size={12} weight="extrabold" color={on ? c.onAccent : c.textPrimary}>
                {m.label}
              </AppText>
            </GlassButton>
          );
        })}
      </ScrollView>
      <View>
        <AppText size={12} weight="bold" tone="secondary">
          {selected ? trendBucketTitle(selected.start, trend.granularity) : periodTitle}
        </AppText>
        <AppText size={26} weight="black">
          {readout}
          {unit && readout !== '–' ? (
            <AppText size={13} weight="bold" tone="secondary">
              {' '}
              {unit}
            </AppText>
          ) : null}
        </AppText>
      </View>
      <View style={{flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT, gap: trend.buckets.length > 20 ? 2 : 5}}>
        {trend.buckets.map((b, i) => {
          const value = values[i];
          const on = i === index;
          return (
            <Pressable
              key={b.start}
              accessibilityRole="button"
              accessibilityLabel={`${trendBucketTitle(b.start, trend.granularity)}: ${def.format(def.read(b), units)} ${unit}`}
              onPress={() => setPicked(i === pick ? null : i)}
              style={{flex: 1, height: '100%', justifyContent: 'flex-end'}}>
              <View
                style={{
                  height: max > 0 && value > 0 ? Math.max(4, (value / max) * CHART_HEIGHT) : 4,
                  borderRadius: 4,
                  backgroundColor: on ? c.accent : value > 0 ? withAlpha(c.accent, 0.32) : c.separator,
                }}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={{flexDirection: 'row', gap: trend.buckets.length > 20 ? 2 : 5, marginTop: -6}}>
        {trend.buckets.map((b, i) => (
          <AppText key={b.start} size={10} weight="bold" tone={i === index ? 'accent' : 'tertiary'} numberOfLines={1} style={{flex: 1, textAlign: 'center'}}>
            {showAxisLabel(i, trend.buckets.length) ? trendAxisLabel(b.start, trend.granularity, period) : ''}
          </AppText>
        ))}
      </View>
    </Card>
  );
}
