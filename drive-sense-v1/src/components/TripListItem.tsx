import React from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useAppTheme} from '../theme/appTheme';

interface TripListItemProps {
  id: string;
  timeLabel?: string;
  distance: number;
  duration: number;
  score: number;
  /** Reverse-geocoded trip endpoints. Absent until the backend has resolved them. */
  startLabel?: string;
  endLabel?: string;
  /** Vehicle the trip was driven in. Gets its own line — it is not a place. */
  vehicleName?: string;
  category?: string;
  eventCount?: number;
  avgSpeedLabel?: string;
  topSpeedLabel?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  onPress?: () => void;
}

const UNSCORED_CATEGORIES = new Set(['Active', 'In Progress', 'Live']);

const DOT_SIZE = 10;
/** Space between an address and the "Start"/"End" caption under it. */
const CAPTION_GAP = 2;
/** Space between the start block and the end block. */
const ROUTE_GAP = 12;

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
  timeLabel,
  distance,
  duration,
  score,
  startLabel,
  endLabel,
  vehicleName,
  category,
  eventCount,
  avgSpeedLabel,
  topSpeedLabel,
  riskLevel = 'low',
  onPress,
}) => {
  const theme = useAppTheme();
  // Read from the theme rather than hardcoded, so the rail keeps its alignment if type scale moves.
  const addressLineHeight = theme.typography.body.lineHeight;
  const captionLineHeight = theme.typography.caption.lineHeight;
  // A trip still in progress hasn't been scored yet — score defaults to 0, which would otherwise
  // paint it the same alarming red as a genuinely bad completed trip.
  const isScored = !category || !UNSCORED_CATEGORIES.has(category) || score > 0;
  const scoreColor = !isScored ? theme.textSubtle : score >= 80 ? theme.success : score >= 60 ? theme.warning : theme.danger;
  const scoreBackground = !isScored ? theme.cardSoft : score >= 80 ? theme.successSoft : score >= 60 ? theme.warningSoft : theme.dangerSoft;
  // Until the reverse geocode lands there is genuinely no address to show. Say so plainly rather
  // than filling the slot with the vehicle name or a status string, which reads as a place.
  const routeStart = startLabel ?? 'Start not available';
  const routeEnd = endLabel ?? 'End not available';
  const startIsKnown = Boolean(startLabel);
  const endIsKnown = Boolean(endLabel);
  const riskColor = riskLevel === 'high' ? theme.danger : riskLevel === 'medium' ? theme.warning : theme.success;
  const riskBackground =
    riskLevel === 'high' ? theme.dangerSoft : riskLevel === 'medium' ? theme.warningSoft : theme.successSoft;
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
            {/*
              Each dot is boxed to exactly one address line-height and centred inside it, so it
              lands on the address rather than floating above the block. The rail's bottom padding
              matches the trailing "End" caption, which is what keeps the second dot level with the
              end address instead of the caption underneath it.
            */}
            <View
              className="mr-3 items-center"
              style={{width: DOT_SIZE, paddingBottom: captionLineHeight + CAPTION_GAP}}>
              <View style={{height: addressLineHeight, justifyContent: 'center'}}>
                <View
                  style={{height: DOT_SIZE, width: DOT_SIZE, borderRadius: DOT_SIZE / 2, backgroundColor: theme.success}}
                />
              </View>
              <View style={{flex: 1, width: 2, marginVertical: 4, backgroundColor: theme.cardBorder}} />
              <View style={{height: addressLineHeight, justifyContent: 'center'}}>
                <View
                  style={{height: DOT_SIZE, width: DOT_SIZE, borderRadius: DOT_SIZE / 2, backgroundColor: theme.danger}}
                />
              </View>
            </View>
            <View className="flex-1">
              <Text
                style={{
                  color: startIsKnown ? theme.text : theme.textMuted,
                  ...theme.typography.body,
                  lineHeight: addressLineHeight,
                  fontWeight: startIsKnown ? '700' : '400',
                }}
                numberOfLines={1}>
                {routeStart}
              </Text>
              <Text
                style={{
                  color: theme.textSubtle,
                  ...theme.typography.caption,
                  lineHeight: captionLineHeight,
                  marginTop: CAPTION_GAP,
                }}>
                Start
              </Text>

              <Text
                style={{
                  color: endIsKnown ? theme.text : theme.textMuted,
                  ...theme.typography.body,
                  lineHeight: addressLineHeight,
                  fontWeight: endIsKnown ? '700' : '400',
                  marginTop: ROUTE_GAP,
                }}
                numberOfLines={1}>
                {routeEnd}
              </Text>
              <Text
                style={{
                  color: theme.textSubtle,
                  ...theme.typography.caption,
                  lineHeight: captionLineHeight,
                  marginTop: CAPTION_GAP,
                }}>
                End
              </Text>
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
            <Text style={{color: scoreColor, fontSize: 11, fontWeight: '800'}}>{isScored ? `Score ${score}` : 'Not yet scored'}</Text>
          </View>
        </View>
      </View>

      {vehicleName ? (
        <View className="mb-2.5 flex-row items-center">
          <Ionicons name="car-sport-outline" size={14} color={theme.textSubtle} />
          <Text
            numberOfLines={1}
            style={{color: theme.textSubtle, ...theme.typography.caption, marginLeft: 6, flexShrink: 1}}>
            {vehicleName}
          </Text>
        </View>
      ) : null}

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
        {topSpeedLabel ? (
          <View
            className="mr-2.5 mb-2 flex-row items-center rounded-full px-3 py-2"
            style={{
              backgroundColor: theme.cardSoft,
            }}>
            <Text style={{color: theme.textSubtle, ...theme.typography.caption, marginRight: 4}}>Top</Text>
            <Text style={{color: theme.text, ...theme.typography.caption, fontWeight: '700'}}>{topSpeedLabel}</Text>
          </View>
        ) : null}
        {eventCount != null ? (
          <View
            className="mr-2.5 mb-2 rounded-full px-3 py-2"
            style={{
              backgroundColor: eventCount > 0 ? theme.warningSoft : theme.successSoft,
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
