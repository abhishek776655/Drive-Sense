import React, {useMemo, useState} from 'react';
import {LayoutChangeEvent, Text, View} from 'react-native';
import {useAppTheme} from '../theme/appTheme';

interface TrendChartProps {
  currentData: number[];
  previousData: number[];
  labels: string[];
  title?: string;
  subtitle?: string;
  metricLabel?: string;
  metricValue?: string;
  metricDelta?: string;
  /** Unit appended to the direct labels and the scale marker. */
  valueUnit?: string;
}

type Point = {x: number; y: number};

const buildPoints = (values: number[], width: number, height: number, maxValue: number): Point[] => {
  const innerWidth = Math.max(1, width - 28);
  const innerHeight = Math.max(1, height - 28);

  return values.map((value, index) => {
    const x = values.length === 1 ? innerWidth / 2 : (index / (values.length - 1)) * innerWidth;
    const y = innerHeight - (value / maxValue) * innerHeight + 10;
    return {x: x + 14, y};
  });
};

const LineSeries = ({
  points,
  color,
  muted = false,
}: {
  points: Point[];
  color: string;
  muted?: boolean;
}) => (
  <>
    {points.slice(0, -1).map((point, index) => {
      const nextPoint = points[index + 1];
      const deltaX = nextPoint.x - point.x;
      const deltaY = nextPoint.y - point.y;
      const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const angle = (Math.atan2(deltaY, deltaX) * 180) / Math.PI;

      return (
        <View
          key={`${index}-${color}`}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: (point.x + nextPoint.x) / 2 - length / 2,
            top: (point.y + nextPoint.y) / 2 - 1,
            width: length,
            height: 2,
            borderRadius: 999,
            backgroundColor: color,
            opacity: muted ? 0.55 : 1,
            transform: [{rotate: `${angle}deg`}],
          }}
        />
      );
    })}

    {points.map((point, index) => (
      <View
        key={`${index}-${color}-dot`}
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: point.x - 4,
          top: point.y - 4,
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
          borderWidth: 2,
          borderColor: '#FFFFFF',
          opacity: muted ? 0.75 : 1,
        }}
      />
    ))}
  </>
);

export const TrendChart: React.FC<TrendChartProps> = ({
  currentData,
  previousData,
  labels,
  title = 'KM Trend',
  subtitle = 'This week vs last week',
  metricLabel,
  metricValue,
  metricDelta,
  valueUnit = 'km',
}) => {
  const theme = useAppTheme();
  const [chartWidth, setChartWidth] = useState(0);
  const maxValue = Math.max(...currentData, ...previousData, 1);
  const chartHeight = 140;

  const currentPoints = useMemo(
    () => buildPoints(currentData, chartWidth, chartHeight, maxValue),
    [chartWidth, currentData, maxValue],
  );
  const previousPoints = useMemo(
    () => buildPoints(previousData, chartWidth, chartHeight, maxValue),
    [chartWidth, previousData, maxValue],
  );

  /**
   * Direct-label the peak and the latest reading only. A number on all seven points collides at this
   * width and buries the shape the chart exists to show.
   */
  const labelledIndexes = useMemo(() => {
    if (currentData.length === 0) {
      return [] as number[];
    }
    const peakIndex = currentData.reduce(
      (best, value, index) => (value > currentData[best] ? index : best),
      0,
    );
    const latestIndex = currentData.length - 1;
    return Array.from(new Set([peakIndex, latestIndex]));
  }, [currentData]);

  const handleLayout = (event: LayoutChangeEvent) => {
    setChartWidth(event.nativeEvent.layout.width);
  };

  return (
    <View
      className="mb-3 rounded-[22px] border p-4"
      style={{
        backgroundColor: theme.card,
        borderColor: theme.cardBorder,
      }}>
      <View className="mb-[14px] flex-row items-center justify-between">
        <View>
          <Text style={{color: theme.text, ...theme.typography.sectionTitle}}>{title}</Text>
          <Text className="mt-0.5" style={{color: theme.textSubtle, ...theme.typography.caption}}>{subtitle}</Text>
        </View>
        {metricDelta ? (
          <View
            className="rounded-full px-2.5 py-1.5"
            style={{
              backgroundColor: theme.accentMuted,
            }}>
            <Text style={{color: theme.accent, fontSize: 11, fontWeight: '700'}}>{metricDelta}</Text>
          </View>
        ) : null}
      </View>

      <View onLayout={handleLayout} className="relative" style={{height: chartHeight}}>
        <View className="absolute inset-x-0 bottom-7 top-3 justify-between">
          {[0.75, 0.5, 0.25].map((line) => (
            <View
              key={line}
              style={{
                height: 1,
                backgroundColor: theme.cardBorder,
                opacity: 0.9,
              }}
            />
          ))}
        </View>

        {chartWidth > 0 ? (
          <>
            <LineSeries points={previousPoints} color={theme.lineMuted} muted />
            <LineSeries points={currentPoints} color={theme.line} />
            {labelledIndexes.map((index) => {
              const point = currentPoints[index];
              if (!point) {
                return null;
              }
              const labelWidth = 54;
              const left = Math.min(Math.max(point.x - labelWidth / 2, 0), Math.max(chartWidth - labelWidth, 0));
              return (
                <View
                  key={`value-${index}`}
                  pointerEvents="none"
                  style={{position: 'absolute', left, top: Math.max(point.y - 20, 0), width: labelWidth}}>
                  <Text
                    numberOfLines={1}
                    style={{color: theme.text, ...theme.typography.caption, fontWeight: '700', textAlign: 'center'}}>
                    {currentData[index]} {valueUnit}
                  </Text>
                </View>
              );
            })}
          </>
        ) : null}


        <View
          pointerEvents="none"
          className="absolute inset-x-0 bottom-0 flex-row justify-between">
          {labels.map((label) => (
              <Text key={label} style={{color: theme.textSubtle, ...theme.typography.caption, textAlign: 'center', width: 24}}>
                {label}
              </Text>
            ))}
        </View>
      </View>

      <View className="mt-[14px] flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          {metricValue ? <Text style={{color: theme.text, fontSize: 18, fontWeight: '700', marginRight: 6}}>{metricValue}</Text> : null}
          {metricLabel ? (
            <Text className="mt-0.5" style={{color: theme.textSubtle, ...theme.typography.caption}} numberOfLines={2}>
              {metricLabel}
            </Text>
          ) : null}
        </View>
        <View className="flex-row items-center gap-[14px] pt-0.5" style={{flexShrink: 0}}>
          <View className="flex-row items-center gap-1.5">
            <View style={{width: 10, height: 10, borderRadius: 5, backgroundColor: theme.line}} />
            <Text style={{color: theme.textSubtle, ...theme.typography.caption}}>This Week</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <View style={{width: 10, height: 10, borderRadius: 5, backgroundColor: theme.lineMuted}} />
            <Text style={{color: theme.textSubtle, ...theme.typography.caption}}>Last Week</Text>
          </View>
        </View>
      </View>
    </View>
  );
};
