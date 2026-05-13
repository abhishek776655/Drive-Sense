import React, {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useFocusEffect} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAppTheme} from '../theme/appTheme';
import {TripsListScreenProps} from '../navigation/types';
import {MOCK_TRIPS} from '../mocks/trackingData';
import {TripListItem} from '../components/TripListItem';
import {SkeletonBlock} from '../components/SkeletonBlock';
import {getApiErrorMessage} from '../services/apiClient';
import {tripsService, type TripRead} from '../services/tripsService';
import {useDashboardStore} from '../store/dashboardStore';

const DATE_FILTERS = ['All Time', 'Today', '7 Days', '30 Days'] as const;
const SCORE_FILTERS = ['All Scores', '90+', '80+', '70+'] as const;
type DateFilterKey = (typeof DATE_FILTERS)[number];
type ScoreFilterKey = (typeof SCORE_FILTERS)[number];

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
};

const formatDistance = (meters: number) => `${(meters / 1000).toFixed(1)} km`;
const formatMonthHeader = (isoDate: string) => new Date(isoDate).toLocaleDateString('en-IN', {month: 'long', year: 'numeric'});
const formatDayLabel = (isoDate: string) => new Date(isoDate).toLocaleDateString('en-IN', {weekday: 'long', month: 'short', day: 'numeric'});
const formatTime = (isoDate: string) => new Date(isoDate).toLocaleTimeString('en-IN', {hour: 'numeric', minute: '2-digit'});

type UiTrip = {
  id: string;
  title: string;
  subtitle: string;
  timeLabel: string;
  distance: number;
  duration: number;
  score: number;
  category: string;
  avgSpeedLabel: string;
  eventCount: number;
  startTime: string;
  vehicleId?: string;
};

export const TripsListScreen: React.FC<TripsListScreenProps> = ({navigation}) => {
  const theme = useAppTheme();
  const dashboard = useDashboardStore((state) => state.data);
  const [activeDateFilter, setActiveDateFilter] = useState<DateFilterKey>('7 Days');
  const [activeScoreFilter, setActiveScoreFilter] = useState<ScoreFilterKey>('All Scores');
  const [activeVehicleFilter, setActiveVehicleFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [backendTrips, setBackendTrips] = useState<TripRead[]>([]);
  const [totalTripsCount, setTotalTripsCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadTrips = async () => {
    try {
      setLoading(true);
      setError(null);
      const now = new Date();
      const startTimeGte =
        activeDateFilter === 'Today'
          ? new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
          : activeDateFilter === '7 Days'
            ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
            : activeDateFilter === '30 Days'
              ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
              : undefined;
      const minScore =
        activeScoreFilter === '90+' ? 90 : activeScoreFilter === '80+' ? 80 : activeScoreFilter === '70+' ? 70 : undefined;

      const response = await tripsService.listTrips({
        vehicleId: activeVehicleFilter === 'all' ? undefined : activeVehicleFilter,
        startTimeGte,
        minScore,
        limit: 100,
        offset: 0,
      });
      setBackendTrips(response.items);
      setTotalTripsCount(response.total);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
      setTotalTripsCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTrips();
  }, [activeDateFilter, activeScoreFilter, activeVehicleFilter]);

  useFocusEffect(
    React.useCallback(() => {
      void loadTrips();
    }, [activeDateFilter, activeScoreFilter, activeVehicleFilter])
  );

  const trips = useMemo<UiTrip[]>(() => {
    if (backendTrips.length > 0) {
      return backendTrips.map((trip) => {
        const avgSpeed = trip.avg_speed_mps != null ? trip.avg_speed_mps * 3.6 : trip.duration_seconds > 0 ? (trip.distance_meters / trip.duration_seconds) * 3.6 : 0;
        return {
          id: trip.id,
          title: trip.vehicle_name,
          subtitle: trip.state === 'ended' ? 'Completed route' : 'Live or recent route',
          timeLabel: `${formatDayLabel(trip.start_time)} • ${formatTime(trip.start_time)}`,
          distance: trip.distance_meters,
          duration: trip.duration_seconds,
          score: trip.driving_score ?? 0,
          category: trip.state === 'ended' ? 'Completed' : 'Active',
          avgSpeedLabel: `${Math.round(avgSpeed)} km/h`,
          eventCount: trip.event_count,
          startTime: trip.start_time,
          vehicleId: trip.vehicle_id,
        };
      });
    }

    return MOCK_TRIPS.map((trip) => ({
      id: trip.id,
      title: trip.title,
      subtitle: trip.subtitle,
      timeLabel: `${formatDayLabel(trip.date)} • ${trip.startTime}`,
      distance: Number.parseFloat(trip.distance) * 1000,
      duration: trip.duration.includes('h')
        ? Number.parseInt(trip.duration, 10) * 3600 + Number.parseInt(trip.duration.split(' ')[1], 10) * 60
        : Number.parseInt(trip.duration, 10) * 60,
      score: trip.score,
      category: trip.category,
      avgSpeedLabel: trip.avgSpeed,
      eventCount: trip.events.length,
      startTime: trip.date,
      vehicleId: undefined,
    }));
  }, [backendTrips]);

  const sortedTrips = useMemo(
    () => [...trips].sort((left, right) => new Date(right.startTime).getTime() - new Date(left.startTime).getTime()),
    [trips]
  );

  const totals = useMemo(() => {
    const totalTrips = sortedTrips.length;
    const totalDistance = sortedTrips.reduce((sum, trip) => sum + trip.distance, 0);
    const totalDuration = sortedTrips.reduce((sum, trip) => sum + trip.duration, 0);
    const averageScore = totalTrips > 0 ? Math.round(sortedTrips.reduce((sum, trip) => sum + trip.score, 0) / totalTrips) : 0;
    const avgSpeed = totalDuration > 0 ? (totalDistance / totalDuration) * 3.6 : 0;
    return {totalTrips, totalDistance, totalDuration, averageScore, avgSpeed};
  }, [sortedTrips]);

  const groupedTrips = useMemo(() => {
    const sections = new Map<string, UiTrip[]>();
    sortedTrips.forEach((trip) => {
      const key = formatMonthHeader(trip.startTime);
      sections.set(key, [...(sections.get(key) ?? []), trip]);
    });
    return Array.from(sections.entries());
  }, [sortedTrips]);

  const refreshTrips = async () => {
    await loadTrips();
  };

  const vehicleFilters = useMemo(
    () => [
      {id: 'all', label: 'All Vehicles'},
      ...((dashboard?.vehicles ?? []).map((vehicle) => ({id: vehicle.id, label: vehicle.name}))),
    ],
    [dashboard?.vehicles],
  );

  return (
    <SafeAreaView className="flex-1" style={{backgroundColor: theme.screen}}>
      <ScrollView
        contentContainerStyle={{paddingHorizontal: 20, paddingTop: 12, paddingBottom: 132}}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refreshTrips()} tintColor={theme.accent} />}>
        <View className="mb-[18px] flex-row items-center justify-between">
          <Pressable
            onPress={() => navigation.goBack()}
            className="size-10 items-center justify-center rounded-[14px] border"
            style={{
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            }}>
            <Ionicons name="chevron-back" size={18} color={theme.text} />
          </Pressable>
          <View className="flex-1 items-center px-2.5">
            <Text style={{color: theme.text, ...theme.typography.pageTitle, fontSize: 24}}>Trips</Text>
            <Text className="mt-0.5" style={{color: theme.textSubtle, ...theme.typography.caption}}>
              History, routes and driving quality
            </Text>
          </View>
          <View className="size-10" />
        </View>

        <View
          className="mb-4 rounded-[28px] border p-[18px]"
          style={{
            backgroundColor: theme.card,
            borderColor: theme.cardBorder,
          }}>
          <View className="mb-[14px] flex-row items-center justify-between">
            <View className="flex-1 pr-2">
              <Text style={{color: theme.text, ...theme.typography.sectionTitle, fontSize: 18}}>Trip Overview</Text>
              <Text className="mt-[3px]" style={{color: theme.textSubtle, ...theme.typography.caption}}>
                Recent trip activity and driving history
              </Text>
            </View>
            <View
              className="rounded-full px-3 py-2"
              style={{
                backgroundColor: theme.accentMuted,
              }}>
              <Text style={{color: theme.accent, ...theme.typography.caption, fontWeight: '700'}}>
                Showing {sortedTrips.length} of {totalTripsCount || sortedTrips.length}
              </Text>
            </View>
          </View>

          <View className="flex-row flex-wrap justify-between">
            {[
              {label: 'Trips', value: String(totals.totalTrips), icon: 'albums-outline' as const},
              {label: 'Total km', value: formatDistance(totals.totalDistance), icon: 'git-compare-outline' as const},
              {label: 'Total time', value: formatDuration(totals.totalDuration), icon: 'time-outline' as const},
              {label: 'Avg speed', value: `${Math.round(totals.avgSpeed)} km/h`, icon: 'speedometer-outline' as const},
            ].map((item) => (
              <View
                key={item.label}
                className="mb-2.5 w-[48.5%] rounded-[20px] border p-[14px]"
                style={{
                  backgroundColor: theme.cardSoft,
                  borderColor: theme.cardBorder,
                }}>
                <View
                  className="mb-2.5 size-[34px] items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: theme.accentMuted,
                  }}>
                  <Ionicons name={item.icon} size={16} color={theme.accent} />
                </View>
                <Text className="mb-1" style={{color: theme.textSubtle, ...theme.typography.caption}}>{item.label}</Text>
                <Text style={{color: theme.text, fontSize: 18, fontWeight: '800'}}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingRight: 8, marginBottom: 18}}>
          {DATE_FILTERS.map((filter) => {
            const active = filter === activeDateFilter;
            return (
              <Pressable
                key={filter}
                onPress={() => setActiveDateFilter(filter)}
                className="mr-2.5 rounded-full border px-[14px] py-2.5"
                style={{
                  backgroundColor: active ? theme.accent : theme.card,
                  borderColor: active ? theme.accent : theme.cardBorder,
                }}>
                <Text style={{color: active ? theme.onAccent : theme.textSubtle, ...theme.typography.caption, fontWeight: '700'}}>
                  {filter}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingRight: 8, marginBottom: 12}}>
          {vehicleFilters.map((filter) => {
            const active = filter.id === activeVehicleFilter;
            return (
              <Pressable
                key={filter.id}
                onPress={() => setActiveVehicleFilter(filter.id)}
                className="mr-2.5 rounded-full border px-[14px] py-2.5"
                style={{
                  backgroundColor: active ? theme.cardSoft : theme.card,
                  borderColor: active ? theme.accent : theme.cardBorder,
                }}>
                <Text style={{color: active ? theme.text : theme.textSubtle, ...theme.typography.caption, fontWeight: '700'}}>
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingRight: 8, marginBottom: 18}}>
          {SCORE_FILTERS.map((filter) => {
            const active = filter === activeScoreFilter;
            return (
              <Pressable
                key={filter}
                onPress={() => setActiveScoreFilter(filter)}
                className="mr-2.5 rounded-full border px-[14px] py-2.5"
                style={{
                  backgroundColor: active ? theme.accentMuted : theme.card,
                  borderColor: active ? theme.accent : theme.cardBorder,
                }}>
                <Text style={{color: active ? theme.accent : theme.textSubtle, ...theme.typography.caption, fontWeight: '700'}}>
                  {filter}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading && backendTrips.length === 0 ? (
          <View className="py-2">
            <SkeletonBlock height={124} radius={24} style={{marginBottom: 14}} />
            <SkeletonBlock height={124} radius={24} style={{marginBottom: 14}} />
            <SkeletonBlock height={124} radius={24} />
          </View>
        ) : null}

        {error ? (
          <View className="mb-[14px] rounded-[20px] border p-4" style={{backgroundColor: theme.card, borderColor: theme.cardBorder}}>
            <Text style={{color: theme.text, ...theme.typography.sectionTitle}}>Server unavailable</Text>
            <Text className="mt-1.5" style={{color: theme.textSubtle, ...theme.typography.body}}>{error}</Text>
          </View>
        ) : null}

        {!loading && !error && groupedTrips.length === 0 ? (
          <View
            className="rounded-3xl border p-[18px]"
            style={{
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            }}>
            <Text style={{color: theme.text, ...theme.typography.sectionTitle}}>No trips yet</Text>
            <Text className="mt-1.5" style={{color: theme.textSubtle, ...theme.typography.body}}>
              Your driving history will appear here once a trip is recorded.
            </Text>
          </View>
        ) : null}

        {groupedTrips.map(([sectionTitle, tripsForDay]) => (
          <View key={sectionTitle} className="mb-[14px]">
            <View className="mb-2.5 flex-row items-center justify-between">
              <Text style={{color: theme.text, ...theme.typography.sectionTitle, fontSize: 14}}>{sectionTitle}</Text>
              <Text style={{color: theme.textSubtle, ...theme.typography.caption}}>
                {tripsForDay.length} trip{tripsForDay.length > 1 ? 's' : ''}
              </Text>
            </View>

            {tripsForDay.map((trip) => (
              <TripListItem
                key={trip.id}
                id={trip.id}
                title={trip.title}
                subtitle={trip.subtitle}
                startLabel={trip.title}
                endLabel={trip.subtitle}
                timeLabel={trip.timeLabel}
                distance={trip.distance}
                duration={trip.duration}
                score={trip.score}
                category={trip.category}
                avgSpeedLabel={trip.avgSpeedLabel}
                eventCount={trip.eventCount}
                riskLevel={trip.eventCount >= 3 ? 'high' : trip.eventCount > 0 || trip.score < 80 ? 'medium' : 'low'}
                onPress={() => navigation.navigate('TripDetails', {tripId: trip.id})}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};
