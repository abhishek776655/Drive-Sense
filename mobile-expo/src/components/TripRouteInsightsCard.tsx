import React from 'react';
import {Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useAppTheme} from '../theme/appTheme';
import {StatTile} from './StatTile';
import type {MockTrip} from '../mocks/trackingData';
import type {RouteSummary} from '../utils/tripRoute';
import {formatDistanceLabel, formatDurationShort, formatSpeedLabel} from '../utils/tripRoute';

type Props = {
  trip: MockTrip;
  summary: RouteSummary;
  mapContent: React.ReactNode;
};

export const TripRouteInsightsCard: React.FC<Props> = ({trip, summary, mapContent}) => {
  const theme = useAppTheme();
  const tripInsights = trip.insights ?? [];
  const totalEventCount = trip.events.length;
  const eventBreakdown = {
    harsh_brake: trip.events.filter((event) => event.event_type === 'harsh_brake').length,
    rapid_acceleration: trip.events.filter((event) => event.event_type === 'rapid_acceleration').length,
    overspeed: trip.events.filter((event) => event.event_type === 'overspeed').length,
  };
  const strongestEvent = [...trip.events].sort((left, right) => right.intensity - left.intensity)[0];
  // A trip still in progress hasn't been scored yet — showing a literal 0 next to a "Clean Drive"
  // badge reads as contradictory, so show a placeholder until the trip actually ends.
  const isScored = trip.status === 'Completed' || trip.drivingScore > 0;
  const riskLevel =
    eventBreakdown.overspeed > 0 || eventBreakdown.harsh_brake > 1
      ? 'High Risk'
      : totalEventCount >= 2
        ? 'Moderate Risk'
        : totalEventCount === 1
          ? 'Low Risk'
          : 'Clean Drive';
  // Low Risk uses a teal distinct from both the brand accent blue and the Clean Drive green,
  // so risk-tier color never overlaps with a color that already means something else on other screens.
  const riskColor =
    riskLevel === 'High Risk'
      ? theme.danger
      : riskLevel === 'Moderate Risk'
        ? theme.warning
        : riskLevel === 'Low Risk'
          ? '#0D9488'
          : theme.success;

  const topStats = [
    {label: 'Road Distance', value: formatDistanceLabel(summary.totalDistanceMeters)},
    {label: 'Drive Time', value: formatDurationShort(summary.totalDurationSeconds)},
    {label: 'Avg Speed', value: formatSpeedLabel(summary.averageSpeedKph)},
    {label: 'Peak Segment', value: formatSpeedLabel(summary.peakSpeedKph)},
  ];

  const supportStats = [
    {label: 'Fuel Consumed', value: trip.fuelConsumed},
    {label: 'Idle Window', value: formatDurationShort(summary.stoppedDurationSeconds)},
    {label: 'Mileage', value: trip.mileage},
    {label: 'Total Events', value: String(totalEventCount)},
  ];

  // Colors match the Dashboard's event-severity mapping (overspeed=danger, harsh_brake=warning,
  // rapid_acceleration=accent) so the same event type doesn't read as a different color per screen.
  const eventCards = [
    {
      key: 'harsh_brake',
      label: 'Harsh Brake',
      icon: 'remove-circle',
      color: theme.warning,
      value: eventBreakdown.harsh_brake,
    },
    {
      key: 'rapid_acceleration',
      label: 'Rapid Accel',
      icon: 'trending-up',
      color: theme.accent,
      value: eventBreakdown.rapid_acceleration,
    },
    {
      key: 'overspeed',
      label: 'Overspeed',
      icon: 'speedometer',
      color: theme.danger,
      value: eventBreakdown.overspeed,
    },
  ];

  const formatEventLabel = (eventType: string) =>
    eventType === 'harsh_brake'
      ? 'Harsh Brake'
      : eventType === 'rapid_acceleration'
        ? 'Rapid Acceleration'
        : 'Overspeed';

  const getBandMeaning = (bandKey: string) =>
    bandKey === 'slow'
      ? 'dense traffic / stops'
      : bandKey === 'urban'
        ? 'city flow'
        : bandKey === 'cruise'
          ? 'stable progress'
          : 'high-speed stretch';

  const getInsightTone = (tone: string) => {
    if (tone === 'warning') {
      return {
        color: theme.warning,
        backgroundColor: theme.warningSoft,
        icon: 'alert-circle',
      };
    }
    if (tone === 'success') {
      return {
        color: theme.success,
        backgroundColor: theme.successMuted,
        icon: 'checkmark-circle',
      };
    }
    return {
      color: theme.accent,
      backgroundColor: theme.accentMuted,
      icon: 'information-circle',
    };
  };

  return (
    <View>
      <View
        className="mb-[14px] rounded-[28px] border p-4"
        style={{backgroundColor: theme.card, borderColor: theme.cardBorder, marginBottom: 14, borderRadius: 28, borderWidth: 1, padding: 16}}>
        <View className="mb-3 flex-row items-start justify-between gap-3">
          <Text
            numberOfLines={2}
            style={{color: theme.text, ...theme.typography.body, fontWeight: '700', flex: 1, minWidth: 0}}>
            {trip.date}
          </Text>
          <View className="flex-shrink-0 flex-row flex-wrap justify-end gap-2" style={{maxWidth: 150}}>
            <View className="rounded-full px-2.5 py-[5px]" style={{backgroundColor: theme.accentMuted}}>
              <Text numberOfLines={1} style={{color: theme.accent, ...theme.typography.caption, fontWeight: '700'}}>
                {trip.category}
              </Text>
            </View>
            <View className="rounded-full px-2.5 py-[5px]" style={{backgroundColor: theme.successSoft}}>
              <Text numberOfLines={1} style={{color: theme.success, ...theme.typography.caption, fontWeight: '700'}}>
                {trip.status}
              </Text>
            </View>
          </View>
        </View>

        <View
          className="mb-3 h-[300px] overflow-hidden rounded-3xl border"
          style={{borderColor: theme.cardBorder, backgroundColor: theme.dark ? '#08101D' : '#EDF4FF', marginBottom: 12, height: 300, overflow: 'hidden', borderRadius: 24, borderWidth: 1}}>
          {mapContent}
        </View>

        <View className="mb-3 rounded-[20px] border p-[14px]" style={{backgroundColor: theme.dark ? '#0E1728' : '#F8FBFF', borderColor: theme.cardBorder}}>
          <View className="flex-row items-stretch">
            <View className="mr-3 items-center">
              <View style={{height: 10, width: 10, borderRadius: 999, backgroundColor: theme.success, marginTop: 4}} />
              <View style={{width: 2, flex: 1, minHeight: 34, marginVertical: 6, backgroundColor: theme.cardBorder}} />
              <View style={{height: 10, width: 10, borderRadius: 999, backgroundColor: '#EF4444'}} />
            </View>
            <View className="flex-1">
              <View className="mb-[14px]">
                <View className="flex-row items-center justify-between gap-3">
                  <Text style={{color: theme.textSubtle, ...theme.typography.caption}}>Start</Text>
                  <Text numberOfLines={1} style={{color: theme.textSubtle, ...theme.typography.caption, flexShrink: 1, textAlign: 'right'}}>
                    {trip.startTime}
                  </Text>
                </View>
                <Text
                  className="mt-1"
                  numberOfLines={2}
                  style={{color: theme.text, ...theme.typography.body, fontWeight: '800', flexShrink: 1}}>
                  {trip.title}
                </Text>
              </View>
              <View>
                <View className="flex-row items-center justify-between gap-3">
                  <Text style={{color: theme.textSubtle, ...theme.typography.caption}}>End</Text>
                  <Text numberOfLines={1} style={{color: theme.textSubtle, ...theme.typography.caption, flexShrink: 1, textAlign: 'right'}}>
                    {trip.endTime}
                  </Text>
                </View>
                <Text
                  className="mt-1"
                  numberOfLines={2}
                  style={{color: theme.text, ...theme.typography.body, fontWeight: '800', flexShrink: 1}}>
                  {trip.subtitle}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View className="mb-3 rounded-[18px] border px-3 py-3" style={{backgroundColor: theme.cardSoft, borderColor: theme.cardBorder}}>
          <View className="flex-row flex-wrap gap-2">
            {summary.bandStats.map((band) => (
              <View
                key={band.key}
                className="flex-row items-center rounded-full border px-2.5 py-2"
                style={{flexDirection: 'row', alignItems: 'center', borderRadius: 999, backgroundColor: theme.card, borderColor: theme.cardBorder, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8}}>
                <View style={{marginRight: 8, height: 10, width: 10, borderRadius: 999, backgroundColor: band.color}} />
                <Text style={{color: theme.text, ...theme.typography.caption, fontWeight: '700'}}>
                  {band.label}: {band.range}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View className="mb-2 flex-row gap-2">
          <View
            className="flex-1 rounded-[22px] border px-[14px] py-[14px]"
            style={{
              flex: 1.1,
              backgroundColor: theme.dark ? '#0E1728' : '#F8FBFF',
              borderColor: theme.cardBorder,
            }}>
            <Text style={{color: theme.textSubtle, ...theme.typography.caption}}>Driving Score</Text>
            <Text className="mt-2" style={{color: theme.text, ...theme.typography.statHero}}>
              {isScored ? trip.drivingScore : '—'}
            </Text>
            <View className="mt-2.5 self-start rounded-full px-2.5 py-1.5" style={{backgroundColor: `${riskColor}1F`}}>
              <Text style={{color: riskColor, ...theme.typography.caption, fontWeight: '800'}}>{riskLevel}</Text>
            </View>
          </View>

          <View className="flex-1 gap-2">
            {topStats.slice(0, 2).map((item) => (
              <StatTile key={item.label} label={item.label} value={item.value} background={theme.cardSoft} width="100%" />
            ))}
          </View>
        </View>

        <View className="flex-row flex-wrap gap-2">
          {topStats.slice(2).map((item) => (
            <StatTile
              key={item.label}
              label={item.label}
              value={item.value}
              background={theme.cardSoft}
              style={{flex: 1, minWidth: 112}}
            />
          ))}
        </View>
      </View>

      {tripInsights.length > 0 ? (
        <View
          className="mb-[14px] rounded-3xl border p-4"
          style={{backgroundColor: theme.card, borderColor: theme.cardBorder, marginBottom: 14, borderRadius: 24, borderWidth: 1, padding: 16}}>
          <Text className="mb-[14px]" style={{color: theme.text, ...theme.typography.sectionTitle}}>Trip Insights</Text>
          <View className="gap-2.5">
            {tripInsights.map((insight) => {
              const tone = getInsightTone(insight.tone);
              return (
                <View
                  key={insight.rule_id}
                  className="rounded-[18px] border px-3 py-3"
                  style={{backgroundColor: theme.cardSoft, borderColor: theme.cardBorder, borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 12}}>
                  <View className="flex-row items-start gap-3">
                    <View
                      className="items-center justify-center rounded-full"
                      style={{height: 30, width: 30, borderRadius: 999, backgroundColor: tone.backgroundColor}}>
                      <Ionicons name={tone.icon as any} size={17} color={tone.color} />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-start justify-between gap-3">
                        <Text
                          numberOfLines={2}
                          style={{color: theme.text, ...theme.typography.body, fontWeight: '800', flex: 1, minWidth: 0}}>
                          {insight.title}
                        </Text>
                        <View className="rounded-full px-2.5 py-1" style={{backgroundColor: tone.backgroundColor}}>
                          <Text numberOfLines={1} style={{color: tone.color, ...theme.typography.caption, fontWeight: '800'}}>
                            {insight.metric_value}
                          </Text>
                        </View>
                      </View>
                      <Text className="mt-1.5" style={{color: theme.textSubtle, ...theme.typography.caption}}>
                        {insight.message}
                      </Text>
                      <Text className="mt-2" style={{color: tone.color, ...theme.typography.caption, fontWeight: '800'}}>
                        {insight.metric_label}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <View
        className="mb-[14px] rounded-3xl border p-4"
        style={{backgroundColor: theme.card, borderColor: theme.cardBorder, marginBottom: 14, borderRadius: 24, borderWidth: 1, padding: 16}}>
        <Text className="mb-[14px]" style={{color: theme.text, ...theme.typography.sectionTitle}}>Behavior Events</Text>
        <View className="mb-3 flex-row flex-wrap gap-2">
          {eventCards.map((item) => (
            <StatTile
              key={item.key}
              label={item.label}
              value={String(item.value)}
              icon={item.icon as any}
              iconColor={item.color}
              variant="inline"
              background={theme.cardSoft}
              style={{flex: 1, minWidth: 112}}
            />
          ))}
        </View>
        {strongestEvent ? (
          <View className="rounded-[18px] border px-3 py-3" style={{backgroundColor: theme.cardSoft, borderColor: theme.cardBorder}}>
            <Text style={{color: theme.textSubtle, ...theme.typography.caption}}>Highest Intensity Event</Text>
            <Text className="mt-2" style={{color: theme.text, ...theme.typography.body, fontWeight: '800'}}>
              {formatEventLabel(strongestEvent.event_type)} • x{strongestEvent.intensity.toFixed(2)}
            </Text>
            <Text className="mt-1.5" style={{color: theme.textSubtle, ...theme.typography.caption}}>
              {strongestEvent.occurred_at.slice(11, 19)} • {strongestEvent.payload.speed_kph ? `${Math.round(strongestEvent.payload.speed_kph)} km/h` : strongestEvent.payload.acceleration_mps2 ? `${strongestEvent.payload.acceleration_mps2.toFixed(2)} m/s²` : 'telemetry event'}
            </Text>
          </View>
        ) : null}
      </View>

      <View
        className="mb-[14px] rounded-3xl border p-4"
        style={{backgroundColor: theme.card, borderColor: theme.cardBorder, marginBottom: 14, borderRadius: 24, borderWidth: 1, padding: 16}}>
        <Text className="mb-[14px]" style={{color: theme.text, ...theme.typography.sectionTitle}}>Speed Profile</Text>
        <View className="gap-2.5">
          {summary.bandStats
            .slice()
            .sort((left, right) => right.durationSeconds - left.durationSeconds)
            .map((band) => {
              const share = summary.totalDurationSeconds > 0 ? Math.round((band.durationSeconds / summary.totalDurationSeconds) * 100) : 0;
              return (
                <View
                  key={band.key}
                  className="rounded-[18px] border px-3 py-3"
                  style={{backgroundColor: theme.cardSoft, borderColor: theme.cardBorder, borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 12}}>
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <View style={{marginRight: 8, height: 10, width: 10, borderRadius: 999, backgroundColor: band.color}} />
                      <Text style={{color: theme.text, ...theme.typography.body, fontWeight: '800'}}>{band.label}</Text>
                    </View>
                    <Text style={{color: theme.text, ...theme.typography.body, fontWeight: '800'}}>{share}%</Text>
                  </View>
                  <Text className="mt-1.5" style={{color: theme.textSubtle, ...theme.typography.caption}}>{band.range} • {getBandMeaning(band.key)}</Text>
                  <View className="mt-2.5 overflow-hidden rounded-full" style={{height: 8, backgroundColor: theme.cardBorder}}>
                    <View style={{width: `${share}%`, height: '100%', borderRadius: 999, backgroundColor: band.color}} />
                  </View>
                  <View className="mt-2.5 flex-row justify-between">
                    <Text style={{color: theme.textSubtle, ...theme.typography.caption}}>{formatDurationShort(band.durationSeconds)}</Text>
                    <Text style={{color: theme.textSubtle, ...theme.typography.caption}}>{formatDistanceLabel(band.distanceMeters)}</Text>
                  </View>
                </View>
              );
            })}
        </View>
      </View>

      <View
        className="mb-[14px] rounded-3xl border p-4"
        style={{backgroundColor: theme.card, borderColor: theme.cardBorder, marginBottom: 14, borderRadius: 24, borderWidth: 1, padding: 16}}>
        <Text className="mb-[14px]" style={{color: theme.text, ...theme.typography.sectionTitle}}>Supporting Stats</Text>
        <View className="flex-row flex-wrap gap-2">
          {supportStats.map((item) => (
            <StatTile
              key={item.label}
              label={item.label}
              value={item.value}
              background={theme.cardSoft}
              style={{flex: 1, minWidth: 112}}
            />
          ))}
        </View>
      </View>

      {trip.events.length > 0 ? (
        <View
          className="mb-[14px] rounded-3xl border p-4"
          style={{backgroundColor: theme.card, borderColor: theme.cardBorder, marginBottom: 14, borderRadius: 24, borderWidth: 1, padding: 16}}>
          <Text className="mb-[14px]" style={{color: theme.text, ...theme.typography.sectionTitle}}>Recent Event Feed</Text>
          <View className="gap-2.5">
            {trip.events.map((event, index) => (
              <View
                key={`${event.event_type}-${event.occurred_at}-${index}`}
                className="rounded-[18px] border px-3 py-3"
                style={{backgroundColor: theme.cardSoft, borderColor: theme.cardBorder, borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 12}}>
                <View className="flex-row items-center justify-between">
                  <Text style={{color: theme.text, ...theme.typography.body, fontWeight: '800'}}>{formatEventLabel(event.event_type)}</Text>
                  <Text style={{color: theme.textSubtle, ...theme.typography.caption}}>{event.occurred_at.slice(11, 19)}</Text>
                </View>
                <Text className="mt-1.5" style={{color: theme.textSubtle, ...theme.typography.caption}}>
                  intensity x{event.intensity.toFixed(2)} • {event.payload.speed_kph ? `${Math.round(event.payload.speed_kph)} km/h` : event.payload.acceleration_mps2 ? `${event.payload.acceleration_mps2.toFixed(2)} m/s²` : 'route event'}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
};
