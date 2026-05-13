import React from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {useAppTheme} from '../theme/appTheme';

interface TripListItemProps {
  id: string;
  title?: string;
  subtitle?: string;
  timeLabel?: string;
  distance: number;
  duration: number;
  score: number;
  startLabel?: string;
  endLabel?: string;
  category?: string;
  eventCount?: number;
  avgSpeedLabel?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  onPress?: () => void;
}

const formatDistance = (meters: number): string => {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
};

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

export const TripListItem: React.FC<TripListItemProps> = ({
  title,
  subtitle,
  timeLabel,
  distance,
  duration,
  score,
  startLabel,
  endLabel,
  category,
  eventCount,
  avgSpeedLabel,
  riskLevel = 'low',
  onPress,
}) => {
  const theme = useAppTheme();
  const scoreColor = score >= 80 ? theme.success : score >= 60 ? theme.warning : theme.danger;
  const scoreBackground = score >= 80 ? theme.successSoft : score >= 60 ? theme.accentMuted : 'rgba(220,38,38,0.10)';
  const routeStart = startLabel ?? title ?? 'Trip start';
  const routeEnd = endLabel ?? subtitle ?? 'Trip end';
  const riskColor = riskLevel === 'high' ? theme.danger : riskLevel === 'medium' ? theme.warning : theme.success;
  const riskBackground =
    riskLevel === 'high' ? 'rgba(220,38,38,0.10)' : riskLevel === 'medium' ? 'rgba(245,158,11,0.12)' : theme.successSoft;
  const riskLabel = riskLevel === 'high' ? 'High Risk' : riskLevel === 'medium' ? 'Watch' : 'Low Risk';
  const showRiskChip = riskLevel !== 'medium';

  return (
    <TouchableOpacity
      onPress={onPress}
      className="mb-3 rounded-[22px] border p-4"
      style={{
        backgroundColor: theme.card,
        borderColor: theme.cardBorder,
        borderWidth: 1,
      }}>
      <View className="mb-3 flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <View className="mb-2 flex-row items-center">
            {category ? (
              <View
                className="mr-2 rounded-full px-2.5 py-1"
                style={{
                  backgroundColor: theme.accentMuted,
                }}>
                <Text style={{color: theme.accent, ...theme.typography.caption, fontWeight: '700'}}>{category}</Text>
              </View>
            ) : null}
            {timeLabel ? <Text style={{color: theme.textMuted, ...theme.typography.caption}}>{timeLabel}</Text> : null}
          </View>

          <View className="flex-row">
            <View className="mr-3 items-center">
              <View className="h-2.5 w-2.5 rounded-full" style={{backgroundColor: theme.success}} />
              <View className="my-1 h-8 w-[2px]" style={{backgroundColor: theme.cardBorder}} />
              <View className="h-2.5 w-2.5 rounded-full" style={{backgroundColor: theme.danger}} />
            </View>
            <View className="flex-1">
              <Text style={{color: theme.text, ...theme.typography.body, fontWeight: '700'}} numberOfLines={1}>
                {routeStart}
              </Text>
              <Text style={{color: theme.textSubtle, ...theme.typography.caption, marginTop: 2}}>Start</Text>

              <Text style={{color: theme.text, ...theme.typography.body, fontWeight: '700', marginTop: 12}} numberOfLines={1}>
                {routeEnd}
              </Text>
              <Text style={{color: theme.textSubtle, ...theme.typography.caption, marginTop: 2}}>End</Text>
            </View>
          </View>
        </View>

        <View className="items-end">
          {showRiskChip ? (
            <View
              className="mb-2 flex-row items-center rounded-full px-2.5 py-1"
              style={{
                backgroundColor: riskBackground,
              }}>
              <View className="mr-1.5 h-2 w-2 rounded-full" style={{backgroundColor: riskColor}} />
              <Text style={{color: riskColor, fontSize: 10, fontWeight: '800'}}>{riskLabel}</Text>
            </View>
          ) : null}
          <View
            className="rounded-full px-3 py-1.5"
            style={{
              backgroundColor: scoreBackground,
            }}>
            <Text style={{color: scoreColor, fontSize: 11, fontWeight: '800'}}>Score {score}</Text>
          </View>
        </View>
      </View>

      <View className="flex-row flex-wrap items-center">
        <View
          className="mr-2.5 mb-2 rounded-full px-3 py-2"
          style={{
            backgroundColor: theme.cardSoft,
          }}>
          <Text style={{color: theme.text, ...theme.typography.caption, fontWeight: '700'}}>{formatDistance(distance)}</Text>
        </View>
        <View
          className="mr-2.5 mb-2 rounded-full px-3 py-2"
          style={{
            backgroundColor: theme.cardSoft,
          }}>
          <Text style={{color: theme.text, ...theme.typography.caption, fontWeight: '700'}}>{formatDuration(duration)}</Text>
        </View>
        {avgSpeedLabel ? (
          <View
            className="mr-2.5 mb-2 rounded-full px-3 py-2"
            style={{
              backgroundColor: theme.cardSoft,
            }}>
            <Text style={{color: theme.text, ...theme.typography.caption, fontWeight: '700'}}>{avgSpeedLabel}</Text>
          </View>
        ) : null}
        {eventCount != null ? (
          <View
            className="mr-2.5 mb-2 rounded-full px-3 py-2"
            style={{
              backgroundColor: eventCount > 0 ? 'rgba(245,158,11,0.12)' : theme.successSoft,
            }}>
            <Text style={{color: eventCount > 0 ? theme.warning : theme.success, ...theme.typography.caption, fontWeight: '700'}}>
              {eventCount} events
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};
