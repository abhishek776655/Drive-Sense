import React, {useEffect, useMemo, useState} from 'react';
import {Image, Pressable, RefreshControl, ScrollView, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAppTheme} from '../theme/appTheme';
import {useCardStyle} from '../components/Card';
import {VehicleListScreenProps} from '../navigation/types';
import {vehicleService, type VehicleStatsRead} from '../services/vehicleService';
import {useDashboardStore} from '../store/dashboardStore';
import {useVehiclePreferencesStore} from '../store/vehiclePreferencesStore';
import {SkeletonBlock} from '../components/SkeletonBlock';
import {EmptyState} from '../components/EmptyState';
import {useAppSidebar} from '../components/AppSidebar';
import {scoreTone, splitUnit} from '../utils/metricFormat';
import {vehicleImageSource} from '../utils/vehicleImage';

/** One radius scale for the screen. Anything outside these three is a bug. */
const RADIUS = {sm: 16, md: 20, lg: 28} as const;

const formatDistance = (meters: number) => `${(meters / 1000).toFixed(1)} km`;
const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
};

const formatLastTrip = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('en-IN', {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'})
    : 'No trips yet';

export const VehiclesScreen: React.FC<VehicleListScreenProps> = ({navigation}) => {
  const theme = useAppTheme();
  const cardStyle = useCardStyle();
  const {openSidebar} = useAppSidebar();
  const dashboard = useDashboardStore((state) => state.data);
  const loading = useDashboardStore((state) => state.loading);
  const dashboardError = useDashboardStore((state) => state.error);
  const fetchDashboard = useDashboardStore((state) => state.fetchDashboard);
  const activeVehicleId = useVehiclePreferencesStore((state) => state.activeVehicleId);
  const hydrateVehiclePreferences = useVehiclePreferencesStore((state) => state.hydrate);
  const [vehicleStatsById, setVehicleStatsById] = useState<Record<string, VehicleStatsRead['summary']>>({});

  useEffect(() => {
    if (!dashboard) {
      void fetchDashboard();
    }
  }, [dashboard, fetchDashboard]);

  useEffect(() => {
    void hydrateVehiclePreferences();
  }, [hydrateVehiclePreferences]);

  useEffect(() => {
    if (!dashboard?.vehicles.length) {
      setVehicleStatsById({});
      return;
    }

    let cancelled = false;

    const loadVehicleStats = async () => {
      try {
        const statsEntries = await Promise.all(
          dashboard.vehicles.map(async (vehicle) => {
            const stats = await vehicleService.getVehicleStats(vehicle.id);
            return [vehicle.id, stats.summary] as const;
          }),
        );

        if (!cancelled) {
          setVehicleStatsById(Object.fromEntries(statsEntries));
        }
      } catch {
        if (!cancelled) {
          setVehicleStatsById({});
        }
      }
    };

    void loadVehicleStats();

    return () => {
      cancelled = true;
    };
  }, [dashboard?.vehicles]);

  const vehicles = useMemo(() => {
    if (dashboard?.vehicles.length) {
      return dashboard.vehicles.map((vehicle, index) => ({
        backendStats: vehicleStatsById[vehicle.id],
        id: vehicle.id,
        name: vehicle.name,
        imageUrl: vehicle.imageUrl,
        fuelType: vehicle.fuelType,
        plate: vehicle.plateNumber ?? 'No plate added',
        mileage: vehicle.mileageBaselineKmPerL != null ? `${vehicle.mileageBaselineKmPerL.toFixed(1)} km/l` : null,
        distance: formatDistance(vehicle.totalDistanceMeters),
        score: vehicle.avgScore || 84,
        trips: vehicle.tripCount,
        lastTrip: formatLastTrip(vehicle.lastTripAt),
        totalDuration: formatDuration(vehicleStatsById[vehicle.id]?.total_duration_seconds ?? 0),
        isActive: activeVehicleId ? vehicle.id === activeVehicleId : index === 0,
      }));
    }
    return [];
  }, [activeVehicleId, dashboard, vehicleStatsById]);

  const featuredVehicle = vehicles.find((vehicle) => vehicle.isActive) ?? vehicles[0];
  const fleetTotals = useMemo(() => {
    const vehicleCount = vehicles.length;
    const averageScore =
      vehicleCount > 0 ? Math.round(vehicles.reduce((sum, vehicle) => sum + vehicle.score, 0) / vehicleCount) : 0;
    const totalTrips = vehicles.reduce((sum, vehicle) => sum + vehicle.trips, 0);
    const totalDistance = vehicles.reduce((sum, vehicle) => sum + Number.parseFloat(vehicle.distance), 0);

    /**
     * How the fleet is spread across the score bands. This is the one comparison in the card that
     * the per-vehicle list below cannot show, so it earns a mark of its own.
     */
    const bands = [
      {key: 'good', label: 'good', min: 90, tone: theme.success, count: 0},
      {key: 'fair', label: 'fair', min: 70, tone: theme.warning, count: 0},
      {key: 'low', label: 'needs work', min: 0, tone: theme.danger, count: 0},
    ];
    vehicles.forEach((vehicle) => {
      const band = bands.find((item) => vehicle.score >= item.min);
      if (band) {
        band.count += 1;
      }
    });

    return {
      vehicleCount,
      averageScore,
      totalTrips,
      totalDistance: `${totalDistance.toFixed(1)} km`,
      totalDuration: formatDuration(dashboard?.stats.totalDurationSeconds ?? 0),
      avgSpeed: `${Math.round(dashboard?.stats.avgSpeed ?? 0)} km/h`,
      bands: bands.filter((band) => band.count > 0),
    };
  }, [dashboard?.stats.avgSpeed, dashboard?.stats.totalDurationSeconds, theme, vehicles]);

  const renderInlineStat = (label: string, rawValue: string, width?: `${number}%`) => {
    const {value, unit} = splitUnit(rawValue);

    return (
      <View key={label} style={width ? {width} : {flex: 1}}>
        <View style={{flexDirection: 'row', alignItems: 'baseline'}}>
          <Text numberOfLines={1} style={{color: theme.text, ...theme.typography.statInline}}>
            {value}
          </Text>
          {unit ? (
            <Text numberOfLines={1} style={{color: theme.textSubtle, ...theme.typography.unit, marginLeft: 3}}>
              {unit}
            </Text>
          ) : null}
        </View>
        <Text numberOfLines={1} style={{color: theme.textSubtle, ...theme.typography.caption, marginTop: 2}}>
          {label}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1" style={{backgroundColor: theme.screen}}>
      <ScrollView
        contentContainerStyle={{paddingHorizontal: 20, paddingTop: 12, paddingBottom: 168}}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void fetchDashboard()} tintColor={theme.accent} />
        }>
        <View className="mb-[18px] flex-row items-center justify-between">
          <Pressable
            onPress={openSidebar}
            accessibilityRole="button"
            accessibilityLabel="Open menu"
            className="size-11 items-center justify-center rounded-2xl border"
            style={{backgroundColor: theme.card, borderColor: theme.cardBorder, borderWidth: 1}}>
            <Ionicons name="menu" size={20} color={theme.text} />
          </Pressable>
          <View className="flex-1 items-center px-2.5">
            <Text style={{color: theme.text, ...theme.typography.pageTitle}}>Garage</Text>
            <Text className="mt-0.5" style={{color: theme.textSubtle, ...theme.typography.caption}} numberOfLines={1}>
              {fleetTotals.vehicleCount} vehicle{fleetTotals.vehicleCount === 1 ? '' : 's'}
              {featuredVehicle ? ' · 1 active' : ''}
            </Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('AddVehicle')}
            accessibilityRole="button"
            accessibilityLabel="Add vehicle"
            className="size-11 items-center justify-center rounded-2xl"
            style={{
              backgroundColor: theme.accent,
            }}>
            <Ionicons name="add" size={22} color={theme.onAccent} />
          </Pressable>
        </View>

        {dashboardError ? (
          <View
            className="mb-4 border p-4"
            style={{
              borderRadius: RADIUS.lg,
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            }}>
            <View className="flex-row items-start">
              <Ionicons
                name="cloud-offline-outline"
                size={18}
                color={theme.danger}
                style={{marginTop: 2, marginRight: 10}}
              />
              <View className="flex-1">
                <Text style={{color: theme.text, ...theme.typography.sectionTitle}}>Server unavailable</Text>
                <Text className="mt-1.5" style={{color: theme.textSubtle, ...theme.typography.body}}>
                  {dashboardError}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {loading && !dashboard ? (
          <View className="pb-2">
            <SkeletonBlock height={172} radius={RADIUS.lg} style={{marginBottom: 16}} />
            <SkeletonBlock height={148} radius={RADIUS.lg} style={{marginBottom: 14}} />
            <SkeletonBlock height={148} radius={RADIUS.lg} />
          </View>
        ) : null}

        {/* Fleet overview: one surface, one hero number, no nested cards. */}
        {!loading && featuredVehicle ? (
          <View
            className="mb-5 overflow-hidden border"
            style={{
              borderRadius: RADIUS.lg,
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
              padding: 18,
            }}>
            <Text style={{color: theme.textSubtle, ...theme.typography.caption, letterSpacing: 0.8}}>
              FLEET OVERVIEW
            </Text>

            <View style={{flexDirection: 'row', alignItems: 'flex-end', marginTop: 12}}>
              <View style={{flex: 1, paddingRight: 12}}>
                <View style={{flexDirection: 'row', alignItems: 'baseline'}}>
                  <Text
                    numberOfLines={1}
                    style={{color: scoreTone(theme, fleetTotals.averageScore), ...theme.typography.statHero}}>
                    {fleetTotals.averageScore}
                  </Text>
                  <Text style={{color: theme.textSubtle, ...theme.typography.caption, marginLeft: 8}}>avg score</Text>
                </View>
                <View
                  style={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: theme.cardSoft,
                    marginTop: 10,
                    overflow: 'hidden',
                  }}>
                  <View
                    style={{
                      width: `${Math.min(100, Math.max(0, fleetTotals.averageScore))}%`,
                      height: '100%',
                      borderRadius: 3,
                      backgroundColor: scoreTone(theme, fleetTotals.averageScore),
                    }}
                  />
                </View>
              </View>

              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: RADIUS.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  backgroundColor: theme.cardSoft,
                  borderWidth: 1,
                  borderColor: theme.cardBorder,
                }}>
                <Image
                  source={vehicleImageSource(featuredVehicle.imageUrl)}
                  style={{width: '100%', height: '100%'}}
                  resizeMode="contain"
                />
              </View>
            </View>

            <Text numberOfLines={1} style={{color: theme.textMuted, ...theme.typography.body, marginTop: 12}}>
              Active: {featuredVehicle.name} · {featuredVehicle.plate}
            </Text>

            {/*
              Score spread: composition across the three bands. Segments are proportional to vehicle
              count, separated by a 2px surface gap, and the legend labels each band so identity is
              never carried by colour alone.
            */}
            {fleetTotals.bands.length > 0 ? (
              <View style={{marginTop: 18}}>
                <Text style={{color: theme.textSubtle, ...theme.typography.caption, letterSpacing: 0.8}}>
                  SCORE SPREAD
                </Text>
                <View style={{flexDirection: 'row', marginTop: 8}}>
                  {fleetTotals.bands.map((band, index) => (
                    <View
                      key={band.key}
                      style={{
                        flex: band.count,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: band.tone,
                        marginLeft: index === 0 ? 0 : 2,
                      }}
                    />
                  ))}
                </View>
                <View style={{flexDirection: 'row', flexWrap: 'wrap', marginTop: 10}}>
                  {fleetTotals.bands.map((band) => (
                    <View
                      key={band.key}
                      style={{flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 2}}>
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: band.tone,
                          marginRight: 6,
                        }}
                      />
                      <Text style={{color: theme.textSubtle, ...theme.typography.caption}}>
                        {band.count} {band.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={{height: 1, backgroundColor: theme.cardBorder, marginTop: 16, marginBottom: 14}} />

            {/*
              Four totals with no comparison to make — stat tiles, not a chart. Two columns, because
              `10h 44m` has no room to breathe in a quarter-width one.
            */}
            <View style={{flexDirection: 'row', flexWrap: 'wrap', rowGap: 14}}>
              {renderInlineStat('trips', String(fleetTotals.totalTrips), '48%')}
              {renderInlineStat('distance', fleetTotals.totalDistance, '48%')}
              {renderInlineStat('drive time', fleetTotals.totalDuration, '48%')}
              {renderInlineStat('avg speed', fleetTotals.avgSpeed, '48%')}
            </View>
          </View>
        ) : !loading ? (
          <View style={{marginBottom: 20}}>
            <EmptyState
              icon="car-sport-outline"
              title="No vehicles yet"
              message="Add your first vehicle to start tracking trips and live telemetry."
              actionLabel="Add Vehicle"
              onAction={() => navigation.navigate('AddVehicle')}
            />
          </View>
        ) : null}

        <View className="mb-3 flex-row items-center justify-between">
          <Text style={{color: theme.text, ...theme.typography.sectionTitle}}>Your Fleet</Text>
          <Text style={{color: theme.textSubtle, ...theme.typography.caption}}>
            {vehicles.length} vehicle{vehicles.length === 1 ? '' : 's'}
          </Text>
        </View>

        {vehicles.map((vehicle) => {
          const tone = scoreTone(theme, vehicle.score);

          return (
            <Pressable
              key={vehicle.id}
              onPress={() => navigation.navigate('VehicleAnalytics', {vehicleId: vehicle.id})}
              accessibilityRole="button"
              accessibilityLabel={`${vehicle.name}, score ${vehicle.score}. Open analytics`}
              className="mb-[14px] overflow-hidden border"
              style={{
                borderRadius: RADIUS.lg,
                backgroundColor: theme.card,
                borderColor: theme.cardBorder,
                padding: 16,
              }}>
              {/* Rail only marks the active vehicle. Green-for-inactive said nothing. */}
              {vehicle.isActive ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 20,
                    bottom: 20,
                    width: 4,
                    borderTopRightRadius: 4,
                    borderBottomRightRadius: 4,
                    backgroundColor: theme.accent,
                  }}
                />
              ) : null}

              <View style={{flexDirection: 'row', alignItems: 'flex-start'}}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: RADIUS.sm,
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    backgroundColor: theme.cardSoft,
                    borderColor: theme.cardBorder,
                    borderWidth: 1,
                    marginRight: 12,
                  }}>
                  <Image
                    source={vehicleImageSource(vehicle.imageUrl)}
                    style={{width: '100%', height: '100%'}}
                    resizeMode="contain"
                  />
                </View>

                <View style={{flex: 1}}>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <Text numberOfLines={1} style={{color: theme.text, ...theme.typography.cardTitle, flexShrink: 1}}>
                      {vehicle.name}
                    </Text>
                    {vehicle.isActive ? (
                      <View
                        style={{
                          marginLeft: 8,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 999,
                          backgroundColor: theme.accentSoft,
                        }}>
                        <Text style={{color: theme.accent, ...theme.typography.caption, fontWeight: '700'}}>
                          Active
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text numberOfLines={1} style={{color: theme.textMuted, ...theme.typography.body, marginTop: 3}}>
                    {vehicle.fuelType}
                    {vehicle.mileage ? ` · ${vehicle.mileage}` : ''} · {vehicle.plate}
                  </Text>
                  <Text numberOfLines={1} style={{color: theme.textSubtle, ...theme.typography.caption, marginTop: 3}}>
                    Last trip {vehicle.lastTrip}
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={18} color={theme.textSubtle} style={{marginTop: 4}} />
              </View>

              {/* Score is the one hero per card; the rest are borderless inline stats. */}
              <View style={{flexDirection: 'row', alignItems: 'flex-end', marginTop: 18}}>
                <View style={{width: 92}}>
                  <Text numberOfLines={1} style={{color: tone, ...theme.typography.statHero}}>
                    {vehicle.score}
                  </Text>
                  <Text style={{color: theme.textSubtle, ...theme.typography.caption, marginTop: 2}}>score</Text>
                </View>
                {/* Three stats, not four: a quarter of the remaining width clips `2h 34m`. */}
                <View style={{flex: 1, flexDirection: 'row', paddingBottom: 4}}>
                  {renderInlineStat('distance', vehicle.distance)}
                  {renderInlineStat('trips', String(vehicle.trips))}
                  {renderInlineStat('drive time', vehicle.totalDuration)}
                </View>
              </View>

              <View
                style={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: theme.cardSoft,
                  marginTop: 14,
                  overflow: 'hidden',
                }}>
                <View
                  style={{
                    width: `${Math.min(100, Math.max(0, vehicle.score))}%`,
                    height: '100%',
                    borderRadius: 3,
                    backgroundColor: tone,
                  }}
                />
              </View>
            </Pressable>
          );
        })}

        <Pressable
          onPress={() => navigation.navigate('AddVehicle')}
          accessibilityRole="button"
          accessibilityLabel="Add another vehicle"
          className="mb-3 mt-0.5 flex-row items-center justify-center border"
          style={{
            borderRadius: RADIUS.lg,
            backgroundColor: theme.card,
            borderColor: theme.cardBorder,
            minHeight: 56,
          }}>
          <Ionicons name="add-circle-outline" size={20} color={theme.accent} />
          <Text className="ml-2" style={{color: theme.accent, ...theme.typography.body, fontWeight: '800'}}>
            Add Another Vehicle
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};
