import React, {useEffect, useState} from 'react';
import {Image, Pressable, RefreshControl, ScrollView, StatusBar as RNStatusBar, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {StatusBar} from 'expo-status-bar';
import {Ionicons} from '@expo/vector-icons';
import {VehicleHeader} from '../components/VehicleHeader';
import {VehicleSelector} from '../components/VehicleSelector';
import {LiveTripCard} from '../components/LiveTripCard';
import {ScoreCard} from '../components/ScoreCard';
import {TrendChart} from '../components/TrendChart';
import {TripListItem} from '../components/TripListItem';
import {SkeletonBlock} from '../components/SkeletonBlock';
import {StatTile} from '../components/StatTile';
import heroCarIllustration from '../assets/illustrations/hero-electric-car.png';
import {useAppSidebar} from '../components/AppSidebar';
import {AppTheme, useAppTheme} from '../theme/appTheme';
import {tripsService, type TripRead} from '../services/tripsService';
import {dashboardService, type RecurringInsight} from '../services/dashboardService';
import {useDashboardStore} from '../store/dashboardStore';
import {useVehiclePreferencesStore} from '../store/vehiclePreferencesStore';
import {DashboardScreenProps} from '../navigation/types';

const FALLBACK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FALLBACK_BARS = [42, 58, 36, 68, 54, 72, 60];
const formatDistance = (meters: number) => `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} km`;

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.max(0, Math.round((seconds % 3600) / 60));
  if (hours === 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
};

const formatEventLabel = (eventType: string) => {
  switch (eventType) {
    case 'harsh_brake':
      return 'Harsh Brake';
    case 'rapid_acceleration':
      return 'Rapid Accel';
    case 'overspeed':
      return 'Overspeed';
    default:
      return eventType.replace(/_/g, ' ');
  }
};

const getEventTone = (eventType: string, palette: AppTheme) => {
  if (eventType === 'overspeed') {
    return {color: palette.danger, backgroundColor: palette.dangerSoft, icon: 'alert-circle' as const};
  }
  if (eventType === 'harsh_brake') {
    return {color: palette.warning, backgroundColor: palette.warningSoft, icon: 'remove-circle' as const};
  }
  return {color: palette.accent, backgroundColor: palette.accentMuted, icon: 'flash' as const};
};


const SnapshotChip = ({
  label,
  value,
  icon,
  palette,
  typography,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  palette: AppTheme;
  typography: AppTheme['typography'];
}) => (
  <View
    className="mr-2.5 mb-2.5 flex-row items-center rounded-full px-3 py-2"
    style={{
      backgroundColor: palette.chip,
      maxWidth: '100%',
    }}>
    <Ionicons name={icon} size={14} color={palette.accent} />
    <Text
      numberOfLines={1}
      style={{color: palette.textSubtle, ...typography.caption, marginLeft: 8, flexShrink: 1}}>
      {label}
    </Text>
    <Text
      numberOfLines={1}
      style={{color: palette.text, ...typography.caption, fontWeight: '700', marginLeft: 6, flexShrink: 0}}>
      {value}
    </Text>
  </View>
);

const InsightBanner = ({
  message,
  type,
  palette,
  typography,
}: {
  message: string;
  type: 'warning' | 'info' | 'success';
  palette: AppTheme;
  typography: AppTheme['typography'];
}) => {
  // Matches TripRouteInsightsCard's getInsightTone mapping so the same insight "type" reads as the
  // same color regardless of which screen renders it.
  const tone = type === 'warning' ? palette.warning : type === 'success' ? palette.success : palette.accent;
  const toneBg =
    type === 'warning' ? palette.warningSoft : type === 'success' ? palette.successSoft : palette.accentMuted;
  const icon = type === 'warning' ? 'alert-circle' : type === 'success' ? 'checkmark-circle' : 'sparkles';

  return (
    <View
      className="mt-3 flex-row items-center rounded-[18px] px-3 py-3"
      style={{
        backgroundColor: toneBg,
      }}>
      <Ionicons name={icon} size={18} color={tone} />
      <Text style={{color: tone, ...typography.body, flex: 1, marginLeft: 10}}>{message}</Text>
    </View>
  );
};

const HeroCarCard = ({
  name,
  plate,
  palette,
  isDark,
  typography,
}: {
  name: string;
  plate: string;
  palette: AppTheme;
  isDark: boolean;
  typography: AppTheme['typography'];
}) => (
  <View
    className="mb-3.5 min-h-[232px] overflow-hidden rounded-[30px] border"
    style={{
      backgroundColor: palette.cardSoft,
      borderColor: palette.cardBorder,
      borderWidth: 1,
    }}>
    <View
      pointerEvents="none"
      className="absolute"
      style={{
        width: 230,
        height: 230,
        borderRadius: 115,
        backgroundColor: palette.screenGlow,
        opacity: isDark ? 0.7 : 0.8,
        top: 20,
        left: -40,
      }}
    />
    <View
      pointerEvents="none"
      className="absolute"
      style={{
        width: 190,
        height: 190,
        borderRadius: 95,
        backgroundColor: palette.accentSoft,
        bottom: -40,
        right: -30,
      }}
    />

    <View className="flex-row items-center justify-between px-[18px] pt-4">
      <View>
        <Text style={{color: palette.text, ...typography.sectionTitle, fontSize: 16}}>{name}</Text>
        <Text style={{color: palette.textSubtle, ...typography.caption, marginTop: 4}}>{plate}</Text>
        <View className="mt-1.5 flex-row items-center">
          <View className="mr-1.5 h-2 w-2 rounded-full" style={{backgroundColor: palette.success}} />
          <Text style={{color: palette.success, ...typography.caption, fontWeight: '600'}}>Online</Text>
        </View>
      </View>
      <View
        className="rounded-full px-3 py-1.5"
        style={{
          backgroundColor: palette.accentMuted,
        }}>
        <Text style={{color: palette.accent, ...typography.caption, fontWeight: '700'}}>My Car</Text>
      </View>
    </View>

    <View className="items-center justify-center pb-3.5 pt-2">
      <View
        className="h-[150px] w-[260px] items-center justify-center rounded-[34px]"
        style={{
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.58)',
        }}>
        <View
          className="absolute bottom-5 h-[24px] w-[190px] rounded-full"
          style={{
            backgroundColor: palette.accentSoft,
            opacity: 0.7,
          }}
        />
        <Image
          source={heroCarIllustration}
          resizeMode="contain"
          style={{width: 236, height: 181}}
          accessibilityLabel={`${name} illustration`}
        />
      </View>
    </View>
  </View>
);

export const DashboardScreen: React.FC<DashboardScreenProps> = ({navigation}) => {
  const theme = useAppTheme();
  const {openSidebar} = useAppSidebar();
  const isDark = theme.dark;
  const palette = theme;
  const activeVehicleId = useVehiclePreferencesStore((state) => state.activeVehicleId);
  const hydrateVehiclePreferences = useVehiclePreferencesStore((state) => state.hydrate);
  const persistActiveVehicleId = useVehiclePreferencesStore((state) => state.setActiveVehicleId);
  const [selectedVehicleId, setSelectedVehicleId] = useState('1');
  const [showSelector, setShowSelector] = useState(false);
  const [statsRange, setStatsRange] = useState<'week' | 'today'>('week');
  const [fallbackTrips, setFallbackTrips] = useState<TripRead[]>([]);
  const [recurringInsights, setRecurringInsights] = useState<RecurringInsight[]>([]);

  const dashboard = useDashboardStore((state) => state.data);
  const loading = useDashboardStore((state) => state.loading);
  const dashboardError = useDashboardStore((state) => state.error);
  const fetchDashboard = useDashboardStore((state) => state.fetchDashboard);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    // Poll every 10 seconds to keep the dashboard updated (LiveTripCard stats, etc.)
    const intervalId = setInterval(() => {
      void fetchDashboard({silent: true});
    }, 10000);

    return () => clearInterval(intervalId);
  }, [fetchDashboard]);

  useEffect(() => {
    // Refresh when screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      void fetchDashboard({silent: true});
    });
    return unsubscribe;
  }, [navigation, fetchDashboard]);

  useEffect(() => {
    void hydrateVehiclePreferences();
  }, [hydrateVehiclePreferences]);

  useEffect(() => {
    const loadFallbackTrips = async () => {
      try {
        const response = await tripsService.listTrips({limit: 20});
        setFallbackTrips(response.items);
      } catch {
        setFallbackTrips([]);
      }
    };

    if (!dashboard?.recentTrips?.length) {
      void loadFallbackTrips();
    }
  }, [dashboard?.recentTrips]);

  useEffect(() => {
    const loadRecurringInsights = async () => {
      try {
        const insights = await dashboardService.getRecurringInsights();
        setRecurringInsights(insights);
      } catch {
        setRecurringInsights([]);
      }
    };

    void loadRecurringInsights();
  }, [dashboard]);

  useEffect(() => {
    if (!dashboard?.vehicles.length) {
      return;
    }
    const preferredVehicleId =
      activeVehicleId && dashboard.vehicles.find((vehicle) => vehicle.id === activeVehicleId)
        ? activeVehicleId
        : dashboard.vehicles[0].id;

    if (!dashboard.vehicles.find((vehicle) => vehicle.id === selectedVehicleId) || selectedVehicleId !== preferredVehicleId) {
      setSelectedVehicleId(preferredVehicleId);
    }
  }, [activeVehicleId, dashboard?.vehicles, selectedVehicleId]);

  const vehicleOptions =
    dashboard?.vehicles.length
      ? dashboard.vehicles.map((vehicle, index) => ({
          id: vehicle.id,
          name: vehicle.name,
          type: vehicle.fuelType,
          imageUrl: vehicle.imageUrl,
          plate: vehicle.plateNumber ?? `${vehicle.fuelType} • ${vehicle.tripCount} trips`,
        }))
      : [];
  const selectedVehicle = vehicleOptions.find((vehicle) => vehicle.id === selectedVehicleId) || vehicleOptions[0];
  const score = dashboard?.score ?? 85;
  const scoreDelta = dashboard?.scoreDelta ?? 5;
  const activeStats = statsRange === 'week' ? dashboard?.weekStats : dashboard?.todayStats;
  const totalDistanceMeters = activeStats?.totalDistance ?? 124000;
  const totalTrips = activeStats?.totalTrips ?? 12;
  const avgSpeed = activeStats?.avgSpeed ?? 42;
  const dashboardDurationSeconds = activeStats?.totalDurationSeconds ?? Math.max(60, Math.round((totalDistanceMeters / Math.max(avgSpeed, 1)) * 3.6));
  const activeSpeed = Math.max(18, Math.round(avgSpeed * 1.45));
  const activeTrips = activeStats?.activeTrips ?? 1;
  const fuelUsedLiters = activeStats?.fuelUsedLiters ?? 18.6;
  const fuelCostAmount = activeStats?.fuelCostAmount ?? 2430;
  const eventSummary = dashboard?.events ?? {
    harshBrakeCount: 2,
    rapidAccelerationCount: 1,
    overspeedCount: 1,
    totalEvents: 4,
  };
  const totalRiskEvents = eventSummary.harshBrakeCount + eventSummary.rapidAccelerationCount + eventSummary.overspeedCount;
  const currentBars = dashboard?.trend.current.length ? dashboard.trend.current : FALLBACK_BARS;
  const previousBars = dashboard?.trend.previous.length ? dashboard.trend.previous : FALLBACK_BARS.map((value) => Math.max(8, value - 8));
  const labels = dashboard?.trend.labels.length ? dashboard.trend.labels : FALLBACK_LABELS;
  const tripHistory = [
    ...(dashboard?.recentTrips?.length
      ? dashboard.recentTrips
      : fallbackTrips.map((trip) => ({
          id: trip.id,
          distance: trip.distance_meters,
          duration: trip.duration_seconds,
          score: trip.driving_score ?? 0,
          eventCount: trip.event_count,
          vehicleName: trip.vehicle_name,
          startedAt: trip.start_time,
          dateLabel: new Date(trip.start_time).toLocaleDateString('en-IN', {month: 'short', day: 'numeric'}),
          timeLabel: new Date(trip.start_time).toLocaleTimeString('en-IN', {
            hour: 'numeric',
            minute: '2-digit',
          }),
        }))),
  ]
    .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime())
    .slice(0, 3);
  const recentEvents = dashboard?.recentEvents?.slice(0, 4) ?? [];
  const sortedVehicles = [...(dashboard?.vehicles ?? [])].sort((left, right) => right.avgScore - left.avgScore);
  const bestVehicle = sortedVehicles[0];
  const worstVehicle = sortedVehicles[sortedVehicles.length - 1];

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: palette.screen}}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void fetchDashboard()} tintColor={palette.accent} />}
        contentContainerStyle={{paddingBottom: 128}}>
        <View className="px-5 pt-3">
          {loading && !dashboard ? (
            <View>
              <SkeletonBlock height={64} radius={18} style={{marginBottom: 14}} />
              <SkeletonBlock height={232} radius={30} style={{marginBottom: 14}} />
              <View className="flex-row flex-wrap justify-between">
                <SkeletonBlock height={96} width="48.5%" radius={20} style={{marginBottom: 10}} />
                <SkeletonBlock height={96} width="48.5%" radius={20} style={{marginBottom: 10}} />
                <SkeletonBlock height={220} width="100%" radius={24} style={{marginBottom: 10}} />
              </View>
            </View>
          ) : null}

          <View className="mb-3.5 flex-row items-center justify-between">
            <Pressable
              onPress={openSidebar}
              className="h-10 w-10 items-center justify-center rounded-[14px] border"
              style={{
                backgroundColor: palette.card,
                borderColor: palette.cardBorder,
                borderWidth: 1,
              }}>
              <Ionicons name="menu" size={20} color={palette.text} />
            </Pressable>

            <View className="flex-row items-baseline">
              <Text style={{color: palette.text, ...theme.typography.pageTitle}}>Drive</Text>
              <Text style={{color: palette.accent, ...theme.typography.pageTitle}}>Sense</Text>
            </View>

            <Pressable
              onPress={() => {}}
              className="h-10 w-10 items-center justify-center rounded-[14px] border"
              style={{
                backgroundColor: palette.card,
                borderColor: palette.cardBorder,
                borderWidth: 1,
              }}>
              <Ionicons name="notifications-outline" size={20} color={palette.text} />
            </Pressable>
          </View>

          <View className="mb-3.5">
            <VehicleHeader
              vehicleName={selectedVehicle?.name ?? 'No Vehicle'}
              vehicleImage={selectedVehicle?.imageUrl ?? undefined}
              isSelected={Boolean(selectedVehicle)}
              onPress={() => setShowSelector(true)}
            />
          </View>

          {dashboardError ? (
            <View
              className="mb-3.5 rounded-3xl border p-4"
              style={{
                backgroundColor: palette.card,
                borderColor: palette.cardBorder,
                borderWidth: 1,
              }}>
              <View className="flex-row items-start">
                <Ionicons name="cloud-offline-outline" size={18} color={palette.danger} style={{marginTop: 2, marginRight: 10}} />
                <View style={{flex: 1}}>
                  <Text style={{color: palette.text, ...theme.typography.sectionTitle}}>Server unavailable</Text>
                  <Text style={{color: palette.textSubtle, ...theme.typography.body, marginTop: 4}}>
                    {dashboardError}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          <HeroCarCard
            name={selectedVehicle?.name ?? 'No Vehicle'}
            plate={selectedVehicle?.plate ?? 'Add a vehicle to start tracking'}
            palette={palette}
            isDark={isDark}
            typography={theme.typography}
          />

          {!dashboard?.vehicles.length && !dashboardError ? (
            <View
              className="mb-3.5 rounded-3xl border p-4"
              style={{
                backgroundColor: palette.card,
                borderColor: palette.cardBorder,
                borderWidth: 1,
              }}>
              <Text style={{color: palette.text, ...theme.typography.sectionTitle}}>No vehicles yet</Text>
              <Text style={{color: palette.textSubtle, ...theme.typography.body, marginTop: 6}}>
                Add your first vehicle to start live tracking, trips, and garage stats.
              </Text>
              <Pressable
                onPress={() => navigation.navigate('VehiclesStack', {screen: 'VehicleList'})}
                className="mt-3 self-start rounded-full px-4 py-2.5"
                style={{backgroundColor: palette.accent}}>
                <Text style={{color: '#FFFFFF', ...theme.typography.caption, fontWeight: '800'}}>Open Garage</Text>
              </Pressable>
            </View>
          ) : null}

          {dashboard?.ongoingTrip ? (
            <LiveTripCard
              vehicleName={dashboard.ongoingTrip.vehicleName}
              startedAt={dashboard.ongoingTrip.startedAt}
              statusLabel="Tracking"
              speed={Math.round(dashboard.ongoingTrip.speed)}
              distance={(dashboard.ongoingTrip.distance / 1000).toFixed(2)}
              duration={formatDuration(dashboard.ongoingTrip.duration)}
              onPressMap={() => navigation.navigate('MapStack', {screen: 'LiveTrackingMain'})}
            />
          ) : null}

          <View
            className="mb-3.5 rounded-3xl border p-4"
            style={{
              backgroundColor: palette.card,
              borderColor: palette.cardBorder,
              borderWidth: 1,
            }}>
            <View className="mb-3 flex-row items-center justify-between">
              <View style={{flex: 1, paddingRight: 10}}>
                <Text style={{color: palette.text, ...theme.typography.sectionTitle}}>All-time Driving</Text>
                <Text style={{color: palette.textSubtle, ...theme.typography.caption, marginTop: 2}}>
                  Lifetime totals across your recorded trips
                </Text>
              </View>
              <View className="rounded-full px-3 py-1.5" style={{backgroundColor: palette.accentMuted}}>
                <Text style={{color: palette.accent, ...theme.typography.caption, fontWeight: '700'}}>
                  Always on
                </Text>
              </View>
            </View>
            <View className="mb-3 flex-row flex-wrap">
              <SnapshotChip
                label="Score"
                value={`${score}/100`}
                icon="shield-checkmark"
                palette={palette}
                typography={theme.typography}
              />
              <SnapshotChip
                label="Avg speed"
                value={`${Math.round(avgSpeed)} km/h`}
                icon="speedometer"
                palette={palette}
                typography={theme.typography}
              />
              <SnapshotChip
                label="Fuel cost"
                value={`₹${Math.round(fuelCostAmount)}`}
                icon="cash"
                palette={palette}
                typography={theme.typography}
              />
              <SnapshotChip
                label="Events"
                value={String(totalRiskEvents)}
                icon="warning"
                palette={palette}
                typography={theme.typography}
              />
            </View>
            <View className="flex-row flex-wrap justify-between">
              <StatTile label="Total km" value={formatDistance(dashboard?.stats.totalDistance ?? 0)} icon="trail-sign" width="31.5%" />
              <StatTile label="Total time" value={formatDuration(dashboard?.stats.totalDurationSeconds ?? 0)} icon="time" width="31.5%" />
              <StatTile label="Avg speed" value={`${Math.round(dashboard?.stats.avgSpeed ?? 0)}`} unit="km/h" icon="speedometer" width="31.5%" />
            </View>
          </View>

          <View
            className="mb-3.5 rounded-3xl border p-4"
            style={{
              backgroundColor: palette.card,
              borderColor: palette.cardBorder,
              borderWidth: 1,
            }}>
            <View className="mb-3 flex-row items-center justify-between">
              <View style={{flex: 1, paddingRight: 10}}>
                <Text style={{color: palette.text, ...theme.typography.sectionTitle}}>Drive Summary</Text>
                <Text style={{color: palette.textSubtle, ...theme.typography.caption, marginTop: 2}}>
                  {statsRange === 'week' ? 'Your last 7 days of driving activity' : 'Your driving activity for today'}
                </Text>
              </View>
              <View
                className="flex-row rounded-full p-1"
                style={{
                  backgroundColor: palette.chip,
                }}>
                {[
                  {label: 'This Week', value: 'week' as const},
                  {label: 'Today', value: 'today' as const},
                ].map((option) => {
                  const active = statsRange === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setStatsRange(option.value)}
                      className="rounded-full px-3 py-1.5"
                      style={{backgroundColor: active ? palette.card : 'transparent'}}>
                      <Text style={{color: active ? palette.text : palette.textSubtle, ...theme.typography.caption, fontWeight: '700'}}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View className="flex-row flex-wrap justify-between">
              <StatTile label="Distance" value={formatDistance(totalDistanceMeters)} icon="speedometer" width="48%" />
              <StatTile label="Drive Time" value={formatDuration(dashboardDurationSeconds)} icon="time" width="48%" />
              <StatTile label="Trips" value={String(totalTrips)} icon="car" width="48%" />
              <StatTile label="Fuel Used" value={fuelUsedLiters.toFixed(1)} unit="L" icon="water" width="48%" />
            </View>
          </View>

          {bestVehicle && worstVehicle && (dashboard?.vehicles.length ?? 0) >= 2 ? (
            <View
              className="mb-3.5 rounded-3xl border p-4"
              style={{
                backgroundColor: palette.card,
                borderColor: palette.cardBorder,
                borderWidth: 1,
              }}>
              <View className="mb-3 flex-row items-center justify-between">
                <View style={{flex: 1, paddingRight: 10}}>
                  <Text style={{color: palette.text, ...theme.typography.sectionTitle}}>Vehicle Insights</Text>
                  <Text style={{color: palette.textSubtle, ...theme.typography.caption, marginTop: 2}}>
                    Best and weakest performers across your fleet
                  </Text>
                </View>
                <Ionicons name="analytics" size={18} color={palette.accent} />
              </View>
              <View className="flex-row justify-between">
                {[
                  {
                    title: 'Best Vehicle',
                    vehicle: bestVehicle,
                    tone: palette.success,
                    toneBg: 'rgba(34,197,94,0.10)',
                    icon: 'trophy',
                  },
                  {
                    title: 'Needs Attention',
                    vehicle: worstVehicle,
                    tone: '#F59E0B',
                    toneBg: 'rgba(245,158,11,0.12)',
                    icon: 'alert-circle',
                  },
                ].map((item) => (
                  <View
                    key={item.title}
                    style={{
                      width: '48.5%',
                      borderRadius: 20,
                      padding: 14,
                      backgroundColor: item.toneBg,
                    }}>
                    <View className="mb-2 flex-row items-center">
                      <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={16} color={item.tone} />
                      <Text style={{color: item.tone, ...theme.typography.caption, fontWeight: '800', marginLeft: 8}}>
                        {item.title}
                      </Text>
                    </View>
                    <Text style={{color: palette.text, ...theme.typography.body, fontWeight: '800'}} numberOfLines={1}>
                      {item.vehicle.name}
                    </Text>
                    <Text style={{color: palette.textSubtle, ...theme.typography.caption, marginTop: 4}} numberOfLines={1}>
                      {item.vehicle.plateNumber ?? item.vehicle.fuelType}
                    </Text>
                    <Text style={{color: palette.text, ...theme.typography.caption, fontWeight: '700', marginTop: 10}}>
                      Score {item.vehicle.avgScore} • {item.vehicle.tripCount} trips
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View
            className="mb-3.5 rounded-3xl border p-4"
            style={{
              backgroundColor: palette.card,
              borderColor: palette.cardBorder,
              borderWidth: 1,
            }}>
            <View className="mb-3 flex-row items-center justify-between">
              <View style={{flex: 1, paddingRight: 10}}>
                <Text style={{color: palette.text, ...theme.typography.sectionTitle}}>Behavior Pulse</Text>
                <Text style={{color: palette.textSubtle, ...theme.typography.caption, marginTop: 2}}>The events shaping driver risk right now</Text>
              </View>
              <View
                className="rounded-full px-3 py-1.5"
                style={{
                  backgroundColor: palette.accentMuted,
                }}>
                <Text style={{color: palette.accent, ...theme.typography.caption, fontWeight: '700'}}>
                  {eventSummary.totalEvents} events
                </Text>
              </View>
            </View>

            <View className="flex-row flex-wrap">
              <SnapshotChip
                label="Harsh Brake"
                value={String(eventSummary.harshBrakeCount)}
                icon="remove-circle"
                palette={palette}
                typography={theme.typography}
              />
              <SnapshotChip
                label="Rapid Accel"
                value={String(eventSummary.rapidAccelerationCount)}
                icon="flash"
                palette={palette}
                typography={theme.typography}
              />
              <SnapshotChip
                label="Overspeed"
                value={String(eventSummary.overspeedCount)}
                icon="alert"
                palette={palette}
                typography={theme.typography}
              />
            </View>

            {recurringInsights.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 12}}>
                {recurringInsights.map((item) => (
                  <View key={item.rule_id} style={{marginRight: 10, width: 260}}>
                    <InsightBanner
                      message={item.message}
                      type={item.tone}
                      palette={palette}
                      typography={theme.typography}
                    />
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>

          <TrendChart
            currentData={currentBars}
            previousData={previousBars}
            labels={labels}
            title="Distance Trend"
            subtitle="This week vs last week"
            metricValue={formatDistance(dashboard?.stats.totalDistance ?? 0)}
            metricLabel={`${Math.round(dashboard?.stats.avgSpeed ?? 0)} km/h average speed`}
            metricDelta={scoreDelta >= 0 ? `${scoreDelta > 0 ? '+' : ''}${scoreDelta} score` : `${scoreDelta} score`}
          />

          <ScoreCard score={score} scoreDelta={scoreDelta} />

          <View
            className="mb-3.5 rounded-3xl border p-4"
            style={{
              backgroundColor: palette.card,
              borderColor: palette.cardBorder,
              borderWidth: 1,
            }}>
            <View className="mb-3.5 flex-row items-center justify-between">
              <View style={{flex: 1, paddingRight: 10}}>
                <Text style={{color: palette.text, ...theme.typography.sectionTitle}}>Recent Events</Text>
                <Text style={{color: palette.textSubtle, ...theme.typography.caption, marginTop: 2}}>
                  Latest harsh braking, overspeed, and acceleration signals
                </Text>
              </View>
              <View className="rounded-full px-3 py-1.5" style={{backgroundColor: palette.accentMuted}}>
                <Text style={{color: palette.accent, ...theme.typography.caption, fontWeight: '700'}}>
                  Live feed
                </Text>
              </View>
            </View>
            {recentEvents.length > 0 ? recentEvents.map((event, index) => {
              const tone = getEventTone(event.eventType, palette);
              return (
                <View
                  key={event.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: palette.cardBorder,
                  }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: tone.backgroundColor,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}>
                    <Ionicons name={tone.icon} size={18} color={tone.color} />
                  </View>
                  <View style={{flex: 1, paddingRight: 12}}>
                    <Text style={{color: palette.text, ...theme.typography.body, fontWeight: '700'}}>
                      {formatEventLabel(event.eventType)}
                    </Text>
                    <Text style={{color: palette.textSubtle, ...theme.typography.caption, marginTop: 2}} numberOfLines={1}>
                      {event.vehicleName} • {event.timeLabel}
                    </Text>
                  </View>
                  {event.intensity != null ? (
                    <Text style={{color: tone.color, ...theme.typography.caption, fontWeight: '800'}}>
                      {event.intensity.toFixed(2)}
                    </Text>
                  ) : null}
                </View>
              );
            }) : (
              <Text style={{color: palette.textSubtle, ...theme.typography.body}}>
                No driving events detected yet.
              </Text>
            )}
          </View>

          <View
            className="mb-3 rounded-3xl border p-4"
            style={{
              backgroundColor: palette.card,
              borderColor: palette.cardBorder,
              borderWidth: 1,
            }}>
            <View className="mb-3.5 flex-row items-center justify-between">
              <View style={{flex: 1, paddingRight: 10}}>
                <Text style={{color: palette.text, ...theme.typography.sectionTitle}}>Last 3 Trips</Text>
                <Text style={{color: palette.textSubtle, ...theme.typography.caption, marginTop: 2}}>
                  Recent drives and trip scores
                </Text>
              </View>
              <Pressable onPress={() => navigation.navigate('TripsStack', {screen: 'TripsList'})}>
                <Text style={{color: palette.accent, ...theme.typography.caption}}>See all</Text>
              </Pressable>
            </View>

            {tripHistory.length > 0 ? tripHistory.map((trip) => (
              <TripListItem
                key={trip.id}
                id={trip.id}
                title={`${trip.dateLabel}, ${trip.timeLabel}`}
                subtitle={trip.vehicleName}
                timeLabel={`Started ${trip.timeLabel}`}
                distance={trip.distance}
                duration={trip.duration}
                score={trip.score}
                onPress={() => navigation.navigate('TripsStack', {screen: 'TripDetails', params: {tripId: trip.id}})}
              />
            )) : (
              <View
                style={{
                  backgroundColor: palette.cardSoft,
                  borderRadius: 20,
                  padding: 16,
                }}>
                <Text style={{color: palette.text, ...theme.typography.sectionTitle}}>No trips yet</Text>
                <Text style={{color: palette.textSubtle, ...theme.typography.body, marginTop: 6}}>
                  Start a live trip and your recent drives will appear here automatically.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <VehicleSelector
        visible={showSelector}
        vehicles={vehicleOptions}
        selectedId={selectedVehicleId}
        onSelect={(vehicleId) => {
          setSelectedVehicleId(vehicleId);
          void persistActiveVehicleId(vehicleId);
        }}
        onClose={() => setShowSelector(false)}
      />
      <RNStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
    </SafeAreaView>
  );
};
