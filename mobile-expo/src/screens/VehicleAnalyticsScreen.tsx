import React, {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Alert, Image, Pressable, RefreshControl, ScrollView, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {getApiErrorMessage} from '../services/apiClient';
import {vehicleService, type VehicleStatsRead} from '../services/vehicleService';
import {VehicleAnalyticsScreenProps} from '../navigation/types';
import {useAppTheme} from '../theme/appTheme';
import {useDashboardStore} from '../store/dashboardStore';
import {useVehiclePreferencesStore} from '../store/vehiclePreferencesStore';
import {SkeletonBlock} from '../components/SkeletonBlock';
import {scoreTone, splitUnit} from '../utils/metricFormat';
import {vehicleImageSource} from '../utils/vehicleImage';

const formatDistance = (meters: number) => `${(meters / 1000).toFixed(1)} km`;

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const formatTime = (isoDate: string) =>
  new Date(isoDate).toLocaleTimeString('en-IN', {hour: 'numeric', minute: '2-digit'});

const formatDate = (isoDate: string) =>
  new Date(isoDate).toLocaleDateString('en-IN', {month: 'short', day: 'numeric'});

export const VehicleAnalyticsScreen: React.FC<VehicleAnalyticsScreenProps> = ({navigation, route}) => {
  const theme = useAppTheme();
  const dashboard = useDashboardStore((state) => state.data);
  const fetchDashboard = useDashboardStore((state) => state.fetchDashboard);
  const activeVehicleId = useVehiclePreferencesStore((state) => state.activeVehicleId);
  const hydrateVehiclePreferences = useVehiclePreferencesStore((state) => state.hydrate);
  const setActiveVehicleId = useVehiclePreferencesStore((state) => state.setActiveVehicleId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<VehicleStatsRead | null>(null);
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('week');

  const vehicle = dashboard?.vehicles.find((item) => item.id === route.params.vehicleId);

  const loadStats = async (nextGranularity: 'day' | 'week' | 'month' = granularity) => {
    try {
      setLoading(true);
      setError(null);
      const response = await vehicleService.getVehicleStats(route.params.vehicleId, nextGranularity);
      setStats(response);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void hydrateVehiclePreferences();
  }, [hydrateVehiclePreferences]);

  useEffect(() => {
    void loadStats(granularity);
  }, [route.params.vehicleId, granularity]);

  const trendBars = useMemo(() => {
    const tripTrend = stats?.trip_trend ?? [];
    const points = tripTrend.slice(-6);
    const maxDistance = Math.max(...points.map((item) => item.distance_meters), 1);
    // `date_trunc('week'/'month', ...)` always returns the same day-of-month/weekday (a Monday for
    // weeks, the 1st for months) across every bucket, so a plain `{weekday: 'short'}` formatter
    // collapses to identical labels ("Mon Mon Mon..."). Format based on the active granularity so
    // each bucket gets a distinguishable label.
    const formatLabel = (bucketStart: string) => {
      const date = new Date(bucketStart);
      if (granularity === 'day') {
        return date.toLocaleDateString('en-IN', {weekday: 'short'});
      }
      if (granularity === 'week') {
        return date.toLocaleDateString('en-IN', {day: 'numeric', month: 'short'});
      }
      return date.toLocaleDateString('en-IN', {month: 'short', year: '2-digit'});
    };

    return points.map((item) => ({
      bucketStart: item.bucket_start,
      label: formatLabel(item.bucket_start),
      value: `${Math.round((item.distance_meters / 1000) * 10) / 10} km`,
      height: Math.max(16, (item.distance_meters / maxDistance) * 88),
      score: item.avg_driving_score,
      scoreDotBottom: item.avg_driving_score != null ? Math.max(4, (item.avg_driving_score / 100) * 88) : null,
    }));
  }, [stats?.trip_trend, granularity]);

  const summary = stats?.summary;
  const avgSpeed = summary && summary.total_duration_seconds > 0
    ? `${Math.round((summary.total_distance_meters / summary.total_duration_seconds) * 3.6)} km/h`
    : '0 km/h';

  /** Number and unit as separate Texts so a unit can never wrap away from its value. */
  const renderMetricValue = (rawValue: string) => {
    const {value, unit} = splitUnit(rawValue);

    return (
      <View style={{flexDirection: 'row', alignItems: 'baseline'}}>
        <Text numberOfLines={1} style={{color: theme.text, ...theme.typography.metricValue}}>
          {value}
        </Text>
        {unit ? (
          <Text numberOfLines={1} style={{color: theme.textSubtle, ...theme.typography.unit, marginLeft: 3}}>
            {unit}
          </Text>
        ) : null}
      </View>
    );
  };

  const handleArchiveVehicle = () => {
    if (!vehicle) {
      return;
    }
    Alert.alert('Archive vehicle', `Remove ${vehicle.name} from your garage?`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Archive',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await vehicleService.archiveVehicle(vehicle.id);
              if (activeVehicleId === vehicle.id) {
                await setActiveVehicleId(null);
              }
              await fetchDashboard();
              navigation.goBack();
            } catch (archiveError) {
              Alert.alert('Unable to archive vehicle', getApiErrorMessage(archiveError));
            }
          })();
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1" style={{backgroundColor: theme.screen}}>
      <ScrollView
        contentContainerStyle={{paddingHorizontal: 20, paddingTop: 12, paddingBottom: 132}}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void loadStats()} tintColor={theme.accent} />}>
        <View className="mb-[18px] flex-row items-center justify-between">
          <Pressable
            onPress={() => navigation.goBack()}
            className="size-11 items-center justify-center rounded-[16px] border"
            style={{
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            }}>
            <Ionicons name="chevron-back" size={18} color={theme.text} />
          </Pressable>
          <View className="flex-1 items-center px-2.5">
            <Text style={{color: theme.text, ...theme.typography.pageTitle}}>Analytics</Text>
            <Text
              className="mt-0.5"
              numberOfLines={1}
              style={{color: theme.textSubtle, ...theme.typography.caption}}>
              {vehicle?.name ?? summary?.vehicle_name ?? 'Vehicle insights'}
            </Text>
          </View>
          <View className="size-11" />
        </View>

        {loading && !stats ? (
          <View className="pb-4">
            <SkeletonBlock height={180} radius={28} style={{marginBottom: 16}} />
            <View className="flex-row flex-wrap justify-between">
              <SkeletonBlock height={92} width="48.5%" radius={20} style={{marginBottom: 10}} />
              <SkeletonBlock height={92} width="48.5%" radius={20} style={{marginBottom: 10}} />
              <SkeletonBlock height={92} width="48.5%" radius={20} style={{marginBottom: 10}} />
              <SkeletonBlock height={92} width="48.5%" radius={20} style={{marginBottom: 10}} />
            </View>
          </View>
        ) : null}

        {error ? (
          <View
            className="mb-4 rounded-[28px] border p-[18px]"
            style={{
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            }}>
            <Text style={{color: theme.text, ...theme.typography.sectionTitle}}>Unable to load vehicle analytics</Text>
            <Text className="mt-1.5" style={{color: theme.textSubtle, ...theme.typography.body}}>{error}</Text>
          </View>
        ) : null}

        {summary ? (
          <>
            <View className="mb-4 flex-row gap-2">
              <Pressable
                onPress={() => navigation.navigate('AddVehicle', {vehicleId: route.params.vehicleId})}
                className="flex-1 rounded-[20px] border px-4 py-3"
                style={{backgroundColor: theme.card, borderColor: theme.cardBorder}}>
                <Text style={{color: theme.text, ...theme.typography.sectionTitle, textAlign: 'center'}}>Edit Vehicle</Text>
              </Pressable>
              <Pressable
                onPress={() => void setActiveVehicleId(route.params.vehicleId)}
                className="flex-1 rounded-[20px] border px-4 py-3"
                style={{
                  backgroundColor: activeVehicleId === route.params.vehicleId ? theme.accentMuted : theme.card,
                  borderColor: activeVehicleId === route.params.vehicleId ? theme.accent : theme.cardBorder,
                }}>
                <Text
                  style={{
                    color: activeVehicleId === route.params.vehicleId ? theme.accent : theme.text,
                    ...theme.typography.sectionTitle,
                    textAlign: 'center',
                  }}>
                  {activeVehicleId === route.params.vehicleId ? 'Active Vehicle' : 'Set Active'}
                </Text>
              </Pressable>
            </View>

            <View
              style={{
                backgroundColor: theme.cardSoft,
                borderColor: theme.cardBorder,
                borderWidth: 1,
                borderRadius: 28,
                padding: 18,
                marginBottom: 16,
                overflow: 'hidden',
              }}>
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: -40,
                  right: -40,
                  width: 180,
                  height: 180,
                  borderRadius: 90,
                  backgroundColor: theme.accentMuted,
                }}
              />
              <View className="mb-4 flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text style={{color: theme.textSubtle, ...theme.typography.caption, letterSpacing: 0.8}}>
                    VEHICLE PROFILE
                  </Text>
                  <Text className="mt-1.5" numberOfLines={1} style={{color: theme.text, ...theme.typography.cardTitle}}>
                    {vehicle?.name ?? summary.vehicle_name}
                  </Text>
                  <Text className="mt-1" style={{color: theme.textMuted, ...theme.typography.body}}>
                    {(vehicle?.plateNumber ?? 'No plate added')} • {(vehicle?.fuelType ?? summary.fuel_type)}
                  </Text>
                </View>
                <View
                  className="size-[86px] items-center justify-center overflow-hidden rounded-[20px] border"
                  style={{
                    backgroundColor: theme.card,
                    borderColor: theme.cardBorder,
                  }}>
                  <Image
                    source={vehicleImageSource(vehicle?.imageUrl ?? summary.vehicle_image_url)}
                    style={{width: '100%', height: '100%'}}
                    resizeMode="contain"
                  />
                </View>
              </View>

              {/* Score is the one hero number in this card; the tiles below are supporting totals. */}
              <View style={{marginBottom: 16}}>
                <View style={{flexDirection: 'row', alignItems: 'baseline'}}>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: scoreTone(theme, Math.round(summary.avg_driving_score ?? 0)),
                      ...theme.typography.statHero,
                    }}>
                    {Math.round(summary.avg_driving_score ?? 0)}
                  </Text>
                  <Text style={{color: theme.textSubtle, ...theme.typography.caption, marginLeft: 8}}>avg score</Text>
                </View>
                <View
                  style={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: theme.card,
                    marginTop: 10,
                    overflow: 'hidden',
                  }}>
                  <View
                    style={{
                      width: `${Math.min(100, Math.max(0, Math.round(summary.avg_driving_score ?? 0)))}%`,
                      height: '100%',
                      borderRadius: 3,
                      backgroundColor: scoreTone(theme, Math.round(summary.avg_driving_score ?? 0)),
                    }}
                  />
                </View>
              </View>

              <View className="flex-row flex-wrap justify-between">
                {[
                  {label: 'Total km', value: formatDistance(summary.total_distance_meters)},
                  {label: 'Drive time', value: formatDuration(summary.total_duration_seconds)},
                  {label: 'Avg speed', value: avgSpeed},
                  {label: 'Trips', value: String(summary.trip_count)},
                ].map((item) => (
                  <View
                    key={item.label}
                    className="mb-2.5 w-[48.5%] rounded-[20px] border p-[14px]"
                    style={{
                      backgroundColor: theme.card,
                      borderColor: theme.cardBorder,
                    }}>
                    <Text className="mb-1.5" style={{color: theme.textSubtle, ...theme.typography.caption}}>
                      {item.label}
                    </Text>
                    {renderMetricValue(item.value)}
                  </View>
                ))}
              </View>
            </View>

            <View
              className="mb-4 rounded-[28px] border p-4"
              style={{
                backgroundColor: theme.card,
                borderColor: theme.cardBorder,
              }}>
              <Text style={{color: theme.text, ...theme.typography.sectionTitle}}>Behavior Breakdown</Text>
              <Text className="mb-3 mt-[3px]" style={{color: theme.textSubtle, ...theme.typography.caption}}>
                Events shaping this vehicle&apos;s driving quality
              </Text>
              <View className="flex-row justify-between">
                {[
                  {label: 'Harsh Brake', value: stats.events.harsh_brake_count, tone: theme.warning},
                  {label: 'Rapid Accel', value: stats.events.rapid_acceleration_count, tone: theme.accent},
                  {label: 'Overspeed', value: stats.events.overspeed_count, tone: theme.danger},
                ].map((item) => (
                  <View
                    key={item.label}
                    className="w-[31.5%] rounded-[20px] border px-2.5 py-3"
                    style={{
                      backgroundColor: theme.cardSoft,
                      borderColor: theme.cardBorder,
                    }}>
                    <Text className="mb-1.5" style={{color: theme.textSubtle, ...theme.typography.caption}}>{item.label}</Text>
                    <Text numberOfLines={1} style={{color: item.tone, ...theme.typography.metricValue}}>
                      {item.value}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View
              className="mb-4 rounded-[28px] border p-4"
              style={{
                backgroundColor: theme.card,
                borderColor: theme.cardBorder,
              }}>
              <View className="flex-row items-center justify-between">
                <View style={{flex: 1, paddingRight: 10}}>
                  <Text style={{color: theme.text, ...theme.typography.sectionTitle}}>Trip Trend</Text>
                  <Text className="mt-[3px]" style={{color: theme.textSubtle, ...theme.typography.caption}}>
                    Distance (bars) and score (dots) over time
                  </Text>
                </View>
                <View className="flex-row rounded-full p-1" style={{backgroundColor: theme.cardSoft}}>
                  {(['week', 'month', 'day'] as const).map((option) => {
                    const active = granularity === option;
                    return (
                      <Pressable
                        key={option}
                        onPress={() => setGranularity(option)}
                        className="rounded-full px-3 py-1.5"
                        style={{backgroundColor: active ? theme.card : 'transparent'}}>
                        <Text
                          style={{
                            color: active ? theme.text : theme.textSubtle,
                            ...theme.typography.caption,
                            fontWeight: '700',
                            textTransform: 'capitalize',
                          }}>
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View className="mt-4 h-[150px] flex-row items-end justify-between">
                {trendBars.length > 0 ? trendBars.map((item) => (
                  <View key={item.bucketStart} className="flex-1 items-center justify-end" style={{height: '100%'}}>
                    <View style={{flex: 1, width: 22, justifyContent: 'flex-end'}}>
                      {item.scoreDotBottom != null ? (
                        <View
                          style={{
                            position: 'absolute',
                            bottom: item.scoreDotBottom,
                            left: '50%',
                            marginLeft: -4,
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: theme.success,
                          }}
                        />
                      ) : null}
                      <View
                        style={{
                          width: 22,
                          height: item.height,
                          borderRadius: 11,
                          backgroundColor: theme.accent,
                        }}
                      />
                    </View>
                    <Text className="mt-2" style={{color: theme.textSubtle, ...theme.typography.caption}}>{item.label}</Text>
                  </View>
                )) : (
                  <Text style={{color: theme.textSubtle, ...theme.typography.body}}>
                    Not enough trip history yet to show a trend.
                  </Text>
                )}
              </View>
              <View className="mt-3 flex-row items-center">
                <View style={{width: 8, height: 8, borderRadius: 4, backgroundColor: theme.accent, marginRight: 6}} />
                <Text style={{color: theme.textSubtle, ...theme.typography.caption, marginRight: 14}}>Distance</Text>
                <View style={{width: 8, height: 8, borderRadius: 4, backgroundColor: theme.success, marginRight: 6}} />
                <Text style={{color: theme.textSubtle, ...theme.typography.caption}}>Score</Text>
              </View>
            </View>

            <View
              className="mb-4 rounded-[28px] border p-4"
              style={{
                backgroundColor: theme.card,
                borderColor: theme.cardBorder,
              }}>
              <Text style={{color: theme.text, ...theme.typography.sectionTitle}}>Fuel</Text>
              <Text className="mb-3 mt-[3px]" style={{color: theme.textSubtle, ...theme.typography.caption}}>
                Usage and cost for this vehicle
              </Text>
              <View className="mb-3 flex-row justify-between">
                <View
                  className="w-[48.5%] rounded-[20px] border p-[14px]"
                  style={{backgroundColor: theme.cardSoft, borderColor: theme.cardBorder}}>
                  <Text className="mb-1.5" style={{color: theme.textSubtle, ...theme.typography.caption}}>
                    Total fuel used
                  </Text>
                  {renderMetricValue(`${summary.total_fuel_used_liters.toFixed(1)} L`)}
                </View>
                <View
                  className="w-[48.5%] rounded-[20px] border p-[14px]"
                  style={{backgroundColor: theme.cardSoft, borderColor: theme.cardBorder}}>
                  <Text className="mb-1.5" style={{color: theme.textSubtle, ...theme.typography.caption}}>
                    Total fuel cost
                  </Text>
                  <Text numberOfLines={1} style={{color: theme.text, ...theme.typography.metricValue}}>
                    ₹{Math.round(summary.total_fuel_cost_amount)}
                  </Text>
                </View>
              </View>
              <View className="h-[70px] flex-row items-end justify-between">
                {trendBars.length > 0 ? (stats?.trip_trend ?? []).slice(-6).map((item, index) => {
                  const maxCost = Math.max(...(stats?.trip_trend ?? []).slice(-6).map((point) => point.fuel_cost_amount), 1);
                  return (
                    <View key={`${item.bucket_start}-${index}`} className="flex-1 items-center justify-end">
                      <View
                        style={{
                          width: 16,
                          height: Math.max(6, (item.fuel_cost_amount / maxCost) * 54),
                          borderRadius: 8,
                          backgroundColor: theme.warning,
                        }}
                      />
                    </View>
                  );
                }) : (
                  <Text style={{color: theme.textSubtle, ...theme.typography.body}}>
                    Not enough trip history yet to show fuel cost trend.
                  </Text>
                )}
              </View>
            </View>

            <View
              className="rounded-[28px] border p-4"
              style={{
                backgroundColor: theme.card,
                borderColor: theme.cardBorder,
              }}>
              <Text style={{color: theme.text, ...theme.typography.sectionTitle}}>Recent Trips</Text>
              <Text className="mb-3 mt-[3px]" style={{color: theme.textSubtle, ...theme.typography.caption}}>
                Latest drives recorded for this vehicle
              </Text>
              {stats.recent_trips.length > 0 ? stats.recent_trips.map((trip, index) => (
                <View
                  key={trip.trip_id}
                  className="py-3"
                  style={{
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: theme.cardBorder,
                  }}>
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-3">
                      <Text style={{color: theme.text, ...theme.typography.sectionTitleSoft}}>
                        {formatDate(trip.start_time)} · {formatTime(trip.start_time)}
                      </Text>
                      <Text className="mt-1" style={{color: theme.textSubtle, ...theme.typography.caption}}>
                        {formatDistance(trip.distance_meters)} • {formatDuration(trip.duration_seconds)} • {trip.event_count} events
                      </Text>
                    </View>
                    <View
                      className="rounded-full px-2.5 py-1.5"
                      style={{
                        backgroundColor: theme.cardSoft,
                      }}>
                      <Text
                        style={{
                          color: scoreTone(theme, trip.driving_score ?? 0),
                          ...theme.typography.caption,
                          fontWeight: '700',
                        }}>
                        {trip.driving_score ?? 0}
                      </Text>
                    </View>
                  </View>
                </View>
              )) : (
                <Text style={{color: theme.textSubtle, ...theme.typography.body}}>
                  No trips recorded for this vehicle yet.
                </Text>
              )}
            </View>

            <Pressable
              onPress={handleArchiveVehicle}
              className="mt-4 rounded-[20px] border px-4 py-4"
              style={{backgroundColor: theme.card, borderColor: theme.cardBorder}}>
              <Text style={{color: theme.danger, ...theme.typography.sectionTitle, textAlign: 'center'}}>
                Archive Vehicle
              </Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};
