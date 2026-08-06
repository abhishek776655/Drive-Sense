import React from 'react';
import {Pressable, Text, View} from 'react-native';
import {useAppTheme} from '../theme/appTheme';

interface LiveTripCardProps {
  vehicleName: string;
  startedAt: string;
  statusLabel?: string;
  speed: number | string;
  distance: number | string;
  duration: string | number;
  onPressMap: () => void;
}

export const LiveTripCard: React.FC<LiveTripCardProps> = ({
  vehicleName,
  startedAt,
  statusLabel = 'Tracking',
  speed,
  distance,
  duration,
  onPressMap,
}) => {
  const theme = useAppTheme();
  const liveMetricText = {
    fontFamily: theme.typography.metricValue.fontFamily,
    fontSize: 25,
    fontWeight: '800' as const,
    lineHeight: 29,
  } as const;

  return (
    <View
      className="mb-3.5 overflow-hidden rounded-[26px] border p-[18px]"
      style={{
        backgroundColor: theme.accent,
        borderColor: theme.accentMuted,
        borderWidth: 1,
      }}>
      <View
        pointerEvents="none"
        className="absolute"
        style={{
          width: 220,
          height: 220,
          borderRadius: 110,
          backgroundColor: theme.accentSoft,
          top: -70,
          right: -70,
        }}
      />
      <View
        pointerEvents="none"
        className="absolute"
        style={{
          width: 160,
          height: 160,
          borderRadius: 80,
          backgroundColor: theme.accentMuted,
          bottom: -60,
          left: -40,
        }}
      />

      <View className="mb-4 flex-row items-start justify-between">
        <View className="mr-3 flex-1">
          <View className="flex-row items-center gap-2">
            <View className="h-2 w-2 rounded-full" style={{backgroundColor: theme.onAccent}} />
            <Text style={{color: theme.onAccent, ...theme.typography.caption, letterSpacing: 0.8}}>LIVE TRIP</Text>
          </View>
          <Text numberOfLines={1} style={{color: theme.onAccentMuted, ...theme.typography.caption, marginTop: 4}}>
            {vehicleName}
          </Text>
        </View>
        <View
          className="rounded-full border px-3 py-[5px]"
          style={{
            borderColor: theme.onAccentMuted,
            borderWidth: 1,
          }}>
          <Text numberOfLines={1} style={{color: theme.onAccent, ...theme.typography.caption}}>{statusLabel}</Text>
        </View>
      </View>

      <View className="flex-row items-start justify-between">
        <View className="min-w-0 flex-1 pr-2">
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={{color: theme.onAccent, ...liveMetricText}}>
            {speed}
          </Text>
          <Text style={{color: theme.onAccent, ...theme.typography.caption, marginTop: 4}}>Speed</Text>
          <Text style={{color: theme.onAccentMuted, ...theme.typography.caption}}>km/h</Text>
        </View>
        <View className="min-w-0 flex-1 px-1">
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={{color: theme.onAccent, ...liveMetricText}}>
            {distance}
          </Text>
          <Text style={{color: theme.onAccent, ...theme.typography.caption, marginTop: 4}}>Distance</Text>
          <Text style={{color: theme.onAccentMuted, ...theme.typography.caption}}>km</Text>
        </View>
        <View className="min-w-0 flex-1 pl-2">
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={{color: theme.onAccent, ...liveMetricText}}>
            {duration}
          </Text>
          <Text style={{color: theme.onAccent, ...theme.typography.caption, marginTop: 4}}>Duration</Text>
          <Text style={{color: theme.onAccentMuted, ...theme.typography.caption}}>elapsed</Text>
        </View>
      </View>

      <View className="mt-[18px] flex-row items-center justify-between gap-3">
        <Text numberOfLines={1} className="min-w-0 flex-1" style={{color: theme.onAccent, ...theme.typography.caption}}>
          Trip started at {startedAt}
        </Text>
        <Pressable
          onPress={onPressMap}
          className="flex-row items-center rounded-full px-3.5 py-2"
          style={{
            backgroundColor: theme.card,
          }}>
          <Text style={{color: theme.accent, ...theme.typography.caption, marginRight: 6}}>View Map</Text>
          <Text style={{color: theme.accent, fontSize: 16, marginTop: -1}}>→</Text>
        </Pressable>
      </View>
    </View>
  );
};
