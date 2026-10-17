import React, {useMemo, useState} from 'react';
import {LayoutChangeEvent, Pressable, Text, View} from 'react-native';
import {useAppTheme} from '../theme/appTheme';
import {Card} from './Card';

export interface TrendChartBucket {
  key: string;
  label: string;
  detailLabel: string;
  value: number;
  tripCount: number;
  score: number | null;
}

interface TrendChartProps {
  buckets: TrendChartBucket[];
  /** Index-aligned values from the preceding window, drawn as a marker on each bar. */
  previousValues: number[];
  title?: string;
  subtitle?: string;
  metricLabel?: string;
  metricValue?: string;
  metricDelta?: string;
  valueUnit?: string;
  currentLabel?: string;
  previousLabel?: string;
  /** Range selector rendered under the header, inside the card. */
  rangeControl?: React.ReactNode;
  /** Replaces the footer metric line while a range is loading or has failed. */
  statusMessage?: string | null;
}

const PLOT_HEIGHT = 132;
/** Stub height for an empty bucket, so a zero day still reads as a day rather than a gap. */
const EMPTY_BAR_HEIGHT = 3;
const TOOLTIP_WIDTH = 148;
/** Axis labels beyond this collide at phone widths, so the chart thins them down to this many. */
const MAX_AXIS_LABELS = 7;

/**
 * Indexes of the axis labels to keep, evenly spread and always including the first and last.
 * A month range carries 6 labels and a day range 14; only the latter needs thinning.
 */
export const pickAxisLabelIndexes = (count: number, maxLabels = MAX_AXIS_LABELS): number[] => {
  if (count <= 0) {
    return [];
  }
  if (count <= maxLabels) {
    return Array.from({length: count}, (_, index) => index);
  }
  const step = (count - 1) / (maxLabels - 1);
  return Array.from(new Set(Array.from({length: maxLabels}, (_, index) => Math.round(index * step))));
};

/** Bar height in pixels for `value`, scaled against the tallest bar in the chart. */
export const scaleBarHeight = (value: number, maxValue: number, plotHeight = PLOT_HEIGHT): number => {
  if (value <= 0 || maxValue <= 0) {
    return EMPTY_BAR_HEIGHT;
  }
  return Math.max(EMPTY_BAR_HEIGHT, (value / maxValue) * plotHeight);
};

/** Left offset that keeps a `width`-wide tooltip centred on a column without leaving the card. */
export const clampTooltipLeft = (columnCenter: number, chartWidth: number, width = TOOLTIP_WIDTH): number =>
  Math.min(Math.max(columnCenter - width / 2, 0), Math.max(chartWidth - width, 0));

export const formatBucketValue = (value: number, unit: string): string =>
  `${value % 1 === 0 ? value : value.toFixed(1)} ${unit}`;

export const TrendChart: React.FC<TrendChartProps> = ({
  buckets,
  previousValues,
  title = 'KM Trend',
  subtitle = '',
  metricLabel,
  metricValue,
  metricDelta,
  valueUnit = 'km',
  currentLabel = 'Current',
  previousLabel = 'Previous',
  rangeControl,
  statusMessage,
}) => {
  const theme = useAppTheme();
  const [chartWidth, setChartWidth] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const maxValue = useMemo(
    () => Math.max(...buckets.map((bucket) => bucket.value), ...previousValues, 1),
    [buckets, previousValues],
  );
  const axisLabelIndexes = useMemo(() => pickAxisLabelIndexes(buckets.length), [buckets.length]);

  const selectedIndex = buckets.findIndex((bucket) => bucket.key === selectedKey);
  const selected = selectedIndex >= 0 ? buckets[selectedIndex] : null;
  const columnWidth = buckets.length > 0 ? chartWidth / buckets.length : 0;

  const handleLayout = (event: LayoutChangeEvent) => {
    setChartWidth(event.nativeEvent.layout.width);
  };

  return (
    <Card style={{marginBottom: 12}}>
      <View className="mb-[14px] flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text style={{color: theme.text, ...theme.typography.sectionTitle}}>{title}</Text>
          {subtitle ? (
            <Text className="mt-0.5" style={{color: theme.textSubtle, ...theme.typography.caption}}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {metricDelta ? (
          <View className="rounded-full px-2.5 py-1.5" style={{backgroundColor: theme.accentMuted}}>
            <Text style={{color: theme.accent, fontSize: 11, fontWeight: '700'}}>{metricDelta}</Text>
          </View>
        ) : null}
      </View>

      {rangeControl ? <View className="mb-3 flex-row">{rangeControl}</View> : null}

      {/* Reserved whether or not a bar is selected, so selecting one never shifts the chart down. */}
      <View style={{height: 62, justifyContent: 'flex-end'}}>
        {/* Positioned from the measured width when there is one; before layout it pins left rather
            than withholding the tooltip the user just asked for. */}
        {selected ? (
          <View
            pointerEvents="none"
            style={{
              width: TOOLTIP_WIDTH,
              marginLeft: clampTooltipLeft(columnWidth * (selectedIndex + 0.5), chartWidth),
              backgroundColor: theme.cardSoft,
              borderColor: theme.cardBorder,
              borderWidth: 1,
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}>
            <Text style={{color: theme.textSubtle, ...theme.typography.caption}} numberOfLines={1}>
              {selected.detailLabel}
            </Text>
            <Text style={{color: theme.text, fontSize: 16, fontWeight: '800', marginTop: 1}}>
              {formatBucketValue(selected.value, valueUnit)}
            </Text>
            <Text style={{color: theme.textSubtle, ...theme.typography.caption, marginTop: 1}} numberOfLines={1}>
              {selected.tripCount} {selected.tripCount === 1 ? 'trip' : 'trips'}
              {selected.score != null ? ` · score ${selected.score}` : ''}
            </Text>
          </View>
        ) : null}
      </View>

      <View onLayout={handleLayout} className="relative" style={{height: PLOT_HEIGHT}}>
        <View className="absolute inset-x-0 top-0 bottom-0 justify-between">
          {[0.75, 0.5, 0.25, 0].map((line) => (
            <View key={line} style={{height: 1, backgroundColor: theme.cardBorder, opacity: 0.9}} />
          ))}
        </View>

        <View className="absolute inset-x-0 bottom-0 flex-row items-end" style={{height: PLOT_HEIGHT}}>
          {buckets.map((bucket, index) => {
            const active = bucket.key === selectedKey;
            const barHeight = scaleBarHeight(bucket.value, maxValue);
            const previousHeight = scaleBarHeight(previousValues[index] ?? 0, maxValue);
            const hasPrevious = (previousValues[index] ?? 0) > 0;

            return (
              <Pressable
                key={bucket.key}
                onPress={() => setSelectedKey(active ? null : bucket.key)}
                accessibilityRole="button"
                accessibilityState={{selected: active}}
                accessibilityLabel={`${bucket.detailLabel}: ${formatBucketValue(bucket.value, valueUnit)}, ${bucket.tripCount} trips`}
                style={{flex: 1, height: PLOT_HEIGHT, justifyContent: 'flex-end', alignItems: 'center'}}>
                {/*
                  The prior window rides on the same bar as a tick rather than a second bar beside
                  it. A 14-bucket day range would otherwise pack 28 bars into a phone width.
                */}
                {hasPrevious ? (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      bottom: previousHeight - 1,
                      width: '68%',
                      height: 2,
                      borderRadius: 2,
                      backgroundColor: theme.lineMuted,
                      opacity: 0.85,
                    }}
                  />
                ) : null}
                <View
                  style={{
                    width: '58%',
                    height: barHeight,
                    borderTopLeftRadius: 6,
                    borderTopRightRadius: 6,
                    backgroundColor: active ? theme.accent : theme.line,
                    opacity: !selectedKey || active ? 1 : 0.35,
                  }}
                />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="mt-2 flex-row" style={{height: 16}}>
        {buckets.map((bucket, index) => (
          <View key={`${bucket.key}-label`} style={{flex: 1, alignItems: 'center'}}>
            {axisLabelIndexes.includes(index) ? (
              <Text
                numberOfLines={1}
                style={{
                  color: bucket.key === selectedKey ? theme.text : theme.textSubtle,
                  ...theme.typography.caption,
                  fontWeight: bucket.key === selectedKey ? '700' : '400',
                }}>
                {bucket.label}
              </Text>
            ) : null}
          </View>
        ))}
      </View>

      <View className="mt-[14px] flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          {statusMessage ? (
            <Text style={{color: theme.textSubtle, ...theme.typography.caption}} numberOfLines={2}>
              {statusMessage}
            </Text>
          ) : (
            <>
              {metricValue ? (
                <Text style={{color: theme.text, fontSize: 18, fontWeight: '700'}}>{metricValue}</Text>
              ) : null}
              {metricLabel ? (
                <Text
                  className="mt-0.5"
                  style={{color: theme.textSubtle, ...theme.typography.caption}}
                  numberOfLines={2}>
                  {metricLabel}
                </Text>
              ) : null}
            </>
          )}
        </View>
        <View className="flex-row items-center gap-[14px] pt-0.5" style={{flexShrink: 0}}>
          <View className="flex-row items-center gap-1.5">
            <View style={{width: 10, height: 10, borderRadius: 3, backgroundColor: theme.line}} />
            <Text style={{color: theme.textSubtle, ...theme.typography.caption}}>{currentLabel}</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <View style={{width: 12, height: 2, borderRadius: 2, backgroundColor: theme.lineMuted}} />
            <Text style={{color: theme.textSubtle, ...theme.typography.caption}}>{previousLabel}</Text>
          </View>
        </View>
      </View>
    </Card>
  );
};
