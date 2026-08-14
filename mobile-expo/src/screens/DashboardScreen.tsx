import React, {useEffect, useMemo, useState} from 'react';
import {Image, Pressable, RefreshControl, ScrollView, StatusBar as RNStatusBar, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {StatusBar} from 'expo-status-bar';
import {Ionicons} from '@expo/vector-icons';
import {VehicleHeader} from '../components/VehicleHeader';
import {VehicleSelector} from '../components/VehicleSelector';
import {LiveTripCard} from '../components/LiveTripCard';
import {ScoreCard} from '../components/ScoreCard';
import {TrendChart} from '../components/TrendChart';
import {SegmentedTabs} from '../components/SegmentedTabs';
import {TripListItem} from '../components/TripListItem';
import {SkeletonBlock} from '../components/SkeletonBlock';
import {EmptyState} from '../components/EmptyState';
import {StatTile} from '../components/StatTile';
import {useAppSidebar} from '../components/AppSidebar';
import {AppTheme, useAppTheme} from '../theme/appTheme';
import {useCardStyle} from '../components/Card';
import {tripsService, type TripRead} from '../services/tripsService';
import {dashboardService, type RecurringInsight} from '../services/dashboardService';
import {useDashboardStore} from '../store/dashboardStore';
import {useVehiclePreferencesStore} from '../store/vehiclePreferencesStore';
import {DashboardScreenProps} from '../navigation/types';
import {vehicleImageSource} from '../utils/vehicleImage';
import {resolveTripRiskLevel} from '../utils/tripRisk';

/** Radius scale for this screen. Anything outside these three is a bug. */
const RADIUS = {sm: 16, md: 20, lg: 28} as const;
/** Minimum comfortable touch target. */
const HIT = 44;
/** Shown wherever the API has given us nothing — never an invented number. */
const DASH = '—';

const RANGE_OPTIONS = [
  {label: 'Today', value: 'today' as const},
  {label: 'Week', value: 'week' as const},
  {label: 'All time', value: 'all' as const},
];

const TREND_RANGE_OPTIONS = [
  {label: 'Day', value: 'day' as const},
  {label: 'Week', value: 'week' as const},
  {label: 'Month', value: 'month' as const},
];

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
  imageUrl,
  palette,
  isDark,
  typography,
  isTracking,
  onPress,
}: {
  name: string;
  plate: string;
  imageUrl?: string | null;
  palette: AppTheme;
  isDark: boolean;
  typography: AppTheme['typography'];
  /** Real tracking state. The dot used to be hardcoded green with nothing behind it. */
  isTracking: boolean;
  /** Opens the vehicle picker. The hero is the biggest thing on the screen and reads as the
   *  current vehicle, so tapping it is the obvious way to change which vehicle that is. */
  onPress?: () => void;
}) => (
  <Pressable
    onPress={onPress}
    disabled={!onPress}
    accessibilityRole={onPress ? 'button' : undefined}
    accessibilityLabel={onPress ? `${name}. Change vehicle` : undefined}
    // No `border` class here: NativeWind's `border` sets a width with its own default colour, and
    // with a function style there is no reliable merge order — that default is what painted a dark
    // outline around the hero. The card reads fine on its tinted fill alone.
    className="mb-3.5 min-h-[286px] overflow-hidden rounded-[28px]"
    style={({pressed}) => ({
      backgroundColor: palette.cardSoft,
      borderWidth: 0,
      opacity: pressed ? 0.92 : 1,
    })}>
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
          <View
            className="mr-1.5 h-2 w-2 rounded-full"
            style={{backgroundColor: isTracking ? palette.success : palette.textSubtle}}
          />
          <Text
            style={{
              color: isTracking ? palette.success : palette.textSubtle,
              ...typography.caption,
              fontWeight: '600',
            }}>
            {isTracking ? 'Tracking' : 'Parked'}
          </Text>
        </View>
      </View>
      {/* Doubles as the affordance for the tap: "My Car" alone gave no hint the hero was
          interactive, so it gains a chevron once there is somewhere to go. */}
      <View
        className="flex-row items-center rounded-full px-3 py-1.5"
        style={{
          backgroundColor: palette.accentMuted,
        }}>
        <Text style={{color: palette.accent, ...typography.caption, fontWeight: '700'}}>
          {onPress ? 'Change' : 'My Car'}
        </Text>
        {onPress ? (
          <Ionicons name="chevron-down" size={13} color={palette.accent} style={{marginLeft: 3}} />
        ) : null}
      </View>
    </View>

    <View className="items-center justify-center px-4 pb-4 pt-1">
      <View
        className="h-[196px] w-full items-center justify-center overflow-hidden rounded-[20px]"
        style={{
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.58)',
        }}>
        <Image
          source={vehicleImageSource(imageUrl)}
          style={{width: '100%', height: '100%'}}
          resizeMode="contain"
          accessibilityLabel={`${name} photo`}
        />
      </View>
    </View>
  </Pressable>
);

export const DashboardScreen: React.FC<DashboardScreenProps> = ({navigation}) => {
  const theme = useAppTheme();
  const cardStyle = useCardStyle();
  const {openSidebar} = useAppSidebar();
  const isDark = theme.dark;
  const palette = theme;
  const activeVehicleId = useVehiclePreferencesStore((state) => state.activeVehicleId);
  const hydrateVehiclePreferences = useVehiclePreferencesStore((state) => state.hydrate);
  const persistActiveVehicleId = useVehiclePreferencesStore((state) => state.setActiveVehicleId);
  const [selectedVehicleId, setSelectedVehicleId] = useState('1');
  const [showSelector, setShowSelector] = useState(false);
  const [statsRange, setStatsRange] = useState<'today' | 'week' | 'all'>('week');
  const [fallbackTrips, setFallbackTrips] = useState<TripRead[]>([]);
  const [recurringInsights, setRecurringInsights] = useState<RecurringInsight[]>([]);

  const dashboard = useDashboardStore((state) => state.data);
  const loading = useDashboardStore((state) => state.loading);
  const dashboardError = useDashboardStore((state) => state.error);
  const fetchDashboard = useDashboardStore((state) => state.fetchDashboard);
  const trendGranularity = useDashboardStore((state) => state.trendGranularity);
  const trendCache = useDashboardStore((state) => state.trendCache);
  const trendLoading = useDashboardStore((state) => state.trendLoading);
  const trendError = useDashboardStore((state) => state.trendError);
  const setTrendGranularity = useDashboardStore((state) => state.setTrendGranularity);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const hasOngoingTrip = Boolean(dashboard?.ongoingTrip);

  useEffect(() => {
    // Only poll while a trip is actually running. A parked dashboard does not need a request
    // every 10 seconds.
    if (!hasOngoingTrip) {
      return;
    }

    const intervalId = setInterval(() => {
      void fetchDashboard({silent: true});
    }, 10000);

    return () => clearInterval(intervalId);
  }, [fetchDashboard, hasOngoingTrip]);

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
  const score = dashboard?.score ?? null;
  const scoreDelta = dashboard?.scoreDelta ?? 0;
  const activeStats =
    statsRange === 'all' ? dashboard?.stats : statsRange === 'week' ? dashboard?.weekStats : dashboard?.todayStats;
  const eventSummary = dashboard?.events ?? null;
  const totalRiskEvents = eventSummary
    ? eventSummary.harshBrakeCount + eventSummary.rapidAccelerationCount + eventSummary.overspeedCount
    : null;
  const activeTrend = trendCache[trendGranularity] ?? null;
  // Keep the card mounted once any range has loaded. Unmounting it while a newly picked range is
  // in flight would rip the tabs the user just tapped off the screen.
  const hasTrend = Object.keys(trendCache).length > 0;
  const trendChartBuckets = useMemo(
    () =>
      (activeTrend?.buckets ?? []).map((bucket) => ({
        key: bucket.key,
        label: bucket.label,
        detailLabel: bucket.detailLabel,
        value: bucket.distanceKm,
        tripCount: bucket.tripCount,
        score: bucket.score,
      })),
    [activeTrend],
  );
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
          vehicleImageUrl: null,
          startAddress: trip.start_address ?? undefined,
          endAddress: trip.end_address ?? undefined,
          state: trip.state,
          avgSpeedKph:
            trip.avg_speed_mps != null
              ? trip.avg_speed_mps * 3.6
              : trip.duration_seconds > 0
                ? (trip.distance_meters / trip.duration_seconds) * 3.6
                : 0,
          topSpeedKph: trip.max_speed_mps != null ? trip.max_speed_mps * 3.6 : null,
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
  // Calling one of two cars "needs attention" is harsh when they score 94 and 92. Require a real
  // fleet and a real gap before singling anyone out.
  const scoreSpread = bestVehicle && worstVehicle ? bestVehicle.avgScore - worstVehicle.avgScore : 0;
  const showVehicleInsights = sortedVehicles.length >= 3 && scoreSpread >= 10;

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
              className="h-11 w-11 items-center justify-center rounded-[16px] border"
              style={{backgroundColor: theme.card, borderColor: theme.cardBorder, borderWidth: 1}}>
              <Ionicons name="menu" size={20} color={palette.text} />
            </Pressable>

            <View className="flex-row items-baseline">
              <Text style={{color: palette.text, ...theme.typography.pageTitle}}>Drive</Text>
              <Text style={{color: palette.accent, ...theme.typography.pageTitle}}>Sense</Text>
            </View>

            {/*
              Notifications are not built yet, so the bell only led to a "coming soon" page.
              Restore this block once there is something behind it.

              <Pressable
                onPress={() =>
                  navigation.navigate('ProfileStack', {
                    screen: 'ComingSoon',
                    params: {title: 'Notifications'},
                    initial: false,
                  } as never)
                }
                className="h-11 w-11 items-center justify-center rounded-[16px] border"
                style={{backgroundColor: theme.card, borderColor: theme.cardBorder, borderWidth: 1}}>
                <Ionicons name="notifications-outline" size={20} color={palette.text} />
              </Pressable>
            */}
            {/* Holds the bell's place so the wordmark stays centred between the two edges. */}
            <View style={{height: 44, width: 44}} />
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
              className="mb-3.5 border p-4"
              style={cardStyle}>
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
            imageUrl={selectedVehicle?.imageUrl}
            palette={palette}
            isDark={isDark}
            typography={theme.typography}
            isTracking={hasOngoingTrip}
            // Only offer the picker when there is actually something to pick between.
            onPress={vehicleOptions.length > 0 ? () => setShowSelector(true) : undefined}
          />

          {!dashboard?.vehicles.length && !dashboardError ? (
            <View style={{marginBottom: 14}}>
              <EmptyState
                icon="car-sport-outline"
                title="No vehicles yet"
                message="Add your first vehicle to start live tracking, trips, and garage stats."
                actionLabel="Add Vehicle"
                onAction={() =>
                  navigation.navigate('VehiclesStack', {screen: 'AddVehicle', initial: false} as never)
                }
              />
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

          {/*
            One Driving card for all three ranges. `stats`, `weekStats` and `todayStats` share a
            shape, so the range switch is client-side only. The old pair of cards disagreed about
            which bucket they read — "All-time" tiles used `stats` while its chips used the week.
          */}
          <View
            className="mb-3.5 border p-4"
            style={{
              borderRadius: RADIUS.lg,
              backgroundColor: palette.card,
              borderColor: palette.cardBorder,
              borderWidth: 1,
            }}>
            <View className="mb-3.5 flex-row items-center justify-between">
              <Text style={{color: palette.text, ...theme.typography.sectionTitle}}>Driving</Text>
              <View className="flex-row rounded-full p-1" style={{backgroundColor: palette.chip}}>
                {RANGE_OPTIONS.map((option) => {
                  const active = statsRange === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setStatsRange(option.value)}
                      accessibilityRole="button"
                      accessibilityLabel={`Show ${option.label} totals`}
                      accessibilityState={{selected: active}}
                      className="rounded-full px-3 py-2"
                      style={{backgroundColor: active ? palette.card : 'transparent'}}>
                      <Text
                        style={{
                          color: active ? palette.text : palette.textSubtle,
                          ...theme.typography.caption,
                          fontWeight: '700',
                        }}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="flex-row flex-wrap justify-between">
              <StatTile
                label="Distance"
                value={activeStats ? formatDistance(activeStats.totalDistance) : DASH}
                icon="trail-sign"
                width="48%"
              />
              <StatTile
                label="Trips"
                value={activeStats ? String(activeStats.totalTrips) : DASH}
                icon="car"
                width="48%"
              />
              <StatTile
                label="Drive time"
                value={activeStats ? formatDuration(activeStats.totalDurationSeconds) : DASH}
                icon="time"
                width="48%"
              />
              <StatTile
                label="Avg speed"
                value={activeStats ? String(Math.round(activeStats.avgSpeed)) : DASH}
                unit={activeStats ? 'km/h' : undefined}
                icon="speedometer"
                width="48%"
              />
            </View>

            {/* Secondary facts ride as chips so they do not compete with the four totals. */}
            <View className="mt-1 flex-row flex-wrap">
              <SnapshotChip
                label="Fuel used"
                value={activeStats ? `${activeStats.fuelUsedLiters.toFixed(1)} L` : DASH}
                icon="water"
                palette={palette}
                typography={theme.typography}
              />
              <SnapshotChip
                label="Fuel cost"
                value={activeStats ? `₹${Math.round(activeStats.fuelCostAmount)}` : DASH}
                icon="cash"
                palette={palette}
                typography={theme.typography}
              />
              <SnapshotChip
                label="Events"
                value={totalRiskEvents == null ? DASH : String(totalRiskEvents)}
                icon="warning"
                palette={palette}
                typography={theme.typography}
              />
              {activeStats && activeStats.activeTrips > 0 ? (
                <SnapshotChip
                  label="Active"
                  value={String(activeStats.activeTrips)}
                  icon="radio"
                  palette={palette}
                  typography={theme.typography}
                />
              ) : null}
            </View>
          </View>

          {/* The headline KPI sits directly under the totals it summarises, not below the fold. */}
          {/*
            A score of 0 is a real, terrible score — so an account with nothing scored yet must not
            be shown one. `score` is null until a trip has actually been scored.
          */}
          {score != null ? (
            <ScoreCard score={score} scoreDelta={scoreDelta} />
          ) : dashboard ? (
            <View style={{marginBottom: 12}}>
              <EmptyState
                icon="speedometer-outline"
                title="No driving score yet"
                message="Record a trip and we'll score your braking, acceleration, cornering and speed."
                actionLabel={dashboard.vehicles.length > 0 ? 'Start Tracking' : undefined}
                onAction={
                  dashboard.vehicles.length > 0
                    ? () => navigation.navigate('MapStack', {screen: 'LiveTrackingMain'})
                    : undefined
                }
              />
            </View>
          ) : null}

          {showVehicleInsights && bestVehicle && worstVehicle ? (
            <View
              className="mb-3.5 border p-4"
              style={cardStyle}>
              <View className="mb-3 flex-row items-center justify-between">
                <View style={{flex: 1, paddingRight: 10}}>
                  <Text style={{color: palette.text, ...theme.typography.sectionTitle}}>Vehicle Insights</Text>
                </View>
                <Ionicons name="analytics" size={18} color={palette.accent} />
              </View>
              <View className="flex-row justify-between">
                {[
                  {
                    title: 'Best Vehicle',
                    vehicle: bestVehicle,
                    tone: palette.success,
                    toneBg: palette.successSoft,
                    icon: 'trophy',
                  },
                  {
                    title: 'Needs Attention',
                    vehicle: worstVehicle,
                    tone: palette.warning,
                    toneBg: palette.warningSoft,
                    icon: 'alert-circle',
                  },
                ].map((item) => (
                  <View
                    key={item.title}
                    style={{
                      width: '48.5%',
                      borderRadius: RADIUS.md,
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

          {/* Counts, insights and the event log are one topic — one card. */}
          <View
            className="mb-3.5 border p-4"
            style={{
              borderRadius: RADIUS.lg,
              backgroundColor: palette.card,
              borderColor: palette.cardBorder,
              borderWidth: 1,
            }}>
            <View className="mb-3 flex-row items-center justify-between">
              <Text style={{color: palette.text, ...theme.typography.sectionTitle}}>Behavior</Text>
              {eventSummary ? (
                <View className="rounded-full px-3 py-1.5" style={{backgroundColor: palette.accentMuted}}>
                  <Text style={{color: palette.accent, ...theme.typography.caption, fontWeight: '700'}}>
                    {eventSummary.totalEvents} events
                  </Text>
                </View>
              ) : null}
            </View>

            {eventSummary ? (
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
            ) : null}

            {recurringInsights.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 12}}>
                {recurringInsights.map((item) => (
                  <View key={item.rule_id} style={{marginRight: 10, width: 260}}>
                    <View className="flex-row items-baseline justify-between">
                      <Text
                        numberOfLines={1}
                        style={{color: palette.text, ...theme.typography.caption, fontWeight: '700', flexShrink: 1}}>
                        {item.title}
                      </Text>
                      {item.metric_value ? (
                        <Text
                          numberOfLines={1}
                          style={{color: palette.textSubtle, ...theme.typography.caption, marginLeft: 8}}>
                          {item.metric_value}
                        </Text>
                      ) : null}
                    </View>
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

            <View style={{height: 1, backgroundColor: palette.cardBorder, marginTop: 14, marginBottom: 2}} />
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

          {hasTrend ? (
            <TrendChart
              buckets={trendChartBuckets}
              previousValues={activeTrend?.previousKm ?? []}
              title="Distance Trend"
              subtitle={activeTrend?.subtitle ?? ''}
              currentLabel={activeTrend?.currentLabel}
              previousLabel={activeTrend?.previousLabel}
              metricValue={activeTrend?.metricValue}
              metricLabel={activeTrend?.metricLabel}
              metricDelta={activeTrend?.metricDelta ?? undefined}
              statusMessage={trendError ?? (trendLoading ? 'Loading range…' : null)}
              rangeControl={
                <SegmentedTabs
                  accessibilityLabel="Distance trend range"
                  options={TREND_RANGE_OPTIONS}
                  value={trendGranularity}
                  onChange={(next) => {
                    void setTrendGranularity(next);
                  }}
                />
              }
            />
          ) : null}

          <View
            className="mb-3 border p-4"
            style={{
              borderRadius: RADIUS.lg,
              backgroundColor: palette.card,
              borderColor: palette.cardBorder,
              borderWidth: 1,
            }}>
            <View className="mb-2 flex-row items-center justify-between">
              <Text style={{color: palette.text, ...theme.typography.sectionTitle}}>Last 3 Trips</Text>
              <Pressable
                onPress={() => navigation.navigate('TripsStack', {screen: 'TripsList'})}
                accessibilityRole="button"
                accessibilityLabel="See all trips"
                style={{minHeight: HIT, paddingHorizontal: 8, justifyContent: 'center'}}>
                <Text style={{color: palette.accent, ...theme.typography.caption, fontWeight: '700'}}>See all</Text>
              </Pressable>
            </View>

            {tripHistory.length > 0 ? tripHistory.map((trip) => (
              <TripListItem
                key={trip.id}
                id={trip.id}
                startLabel={trip.startAddress}
                endLabel={trip.endAddress}
                vehicleName={trip.vehicleName}
                timeLabel={`${trip.dateLabel} • ${trip.timeLabel}`}
                distance={trip.distance}
                duration={trip.duration}
                score={trip.score}
                category={trip.state === 'ended' ? 'Completed' : 'Active'}
                avgSpeedLabel={`${Math.round(trip.avgSpeedKph)} km/h`}
                topSpeedLabel={trip.topSpeedKph != null ? `${Math.round(trip.topSpeedKph)} km/h` : undefined}
                eventCount={trip.eventCount}
                riskLevel={resolveTripRiskLevel({
                  eventCount: trip.eventCount,
                  score: trip.score,
                  isCompleted: trip.state === 'ended',
                })}
                onPress={() =>
                  navigation.navigate('TripsStack', {
                    screen: 'TripDetails',
                    params: {tripId: trip.id},
                    // Without this the stack is *replaced* by TripDetails, leaving goBack() nothing
                    // to pop, so back from a trip opened here unwound to the Home tab.
                    initial: false,
                  })
                }
              />
            )) : (
              <EmptyState
                boxed={false}
                compact
                icon="navigate-outline"
                title="No trips yet"
                message="Start a live trip and your recent drives will appear here automatically."
                actionLabel="Start Tracking"
                onAction={() => navigation.navigate('MapStack', {screen: 'LiveTrackingMain'})}
              />
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
        onAddVehicle={() => navigation.navigate('VehiclesStack', {screen: 'AddVehicle', initial: false} as never)}
      />
      <RNStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
    </SafeAreaView>
  );
};
