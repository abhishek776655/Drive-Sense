import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, RefreshControl, ScrollView, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAppTheme} from '../theme/appTheme';
import {VehicleListScreenProps} from '../navigation/types';
import {vehicleService, type VehicleStatsRead} from '../services/vehicleService';
import {useDashboardStore} from '../store/dashboardStore';
import {useVehiclePreferencesStore} from '../store/vehiclePreferencesStore';
import {SkeletonBlock} from '../components/SkeletonBlock';

const formatDistance = (meters: number) => `${(meters / 1000).toFixed(1)} km`;
const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
};

const formatAvgSpeed = (distanceMeters: number, durationSeconds: number) =>
  durationSeconds > 0 ? `${Math.round((distanceMeters / durationSeconds) * 3.6)} km/h` : '0 km/h';

const formatLastTrip = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('en-IN', {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'})
    : 'No trips yet';

export const VehiclesScreen: React.FC<VehicleListScreenProps> = ({navigation}) => {
  const theme = useAppTheme();
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
          })
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
        fuelType: vehicle.fuelType,
        plate: vehicle.plateNumber ?? 'No plate added',
        mileage: vehicle.mileageBaselineKmPerL != null ? `${vehicle.mileageBaselineKmPerL.toFixed(1)} km/l` : 'Not set',
        distance: formatDistance(vehicle.totalDistanceMeters),
        score: vehicle.avgScore || 84,
        trips: vehicle.tripCount,
        lastTrip: formatLastTrip(vehicle.lastTripAt),
        totalDuration: formatDuration(vehicleStatsById[vehicle.id]?.total_duration_seconds ?? 0),
        avgSpeed: formatAvgSpeed(
          vehicleStatsById[vehicle.id]?.total_distance_meters ?? vehicle.totalDistanceMeters,
          vehicleStatsById[vehicle.id]?.total_duration_seconds ?? 0
        ),
        isActive: activeVehicleId ? vehicle.id === activeVehicleId : index === 0,
        accent: index === 0 ? '#246BFF' : index === 1 ? '#0F9D58' : '#F59E0B',
      }));
    }
    return [];
  }, [activeVehicleId, dashboard, vehicleStatsById]);

  const featuredVehicle = vehicles[0];
  const fleetTotals = useMemo(() => {
    const vehicleCount = vehicles.length;
    const averageScore =
      vehicleCount > 0 ? Math.round(vehicles.reduce((sum, vehicle) => sum + vehicle.score, 0) / vehicleCount) : 0;
    const totalTrips = vehicles.reduce((sum, vehicle) => sum + vehicle.trips, 0);
    const totalDistance = vehicles.reduce((sum, vehicle) => sum + Number.parseFloat(vehicle.distance), 0);

    return {
      vehicleCount,
        averageScore,
        totalTrips,
        totalDistance: `${totalDistance.toFixed(1)} km`,
        totalDuration: formatDuration(dashboard?.stats.totalDurationSeconds ?? 0),
        avgSpeed: `${Math.round(dashboard?.stats.avgSpeed ?? 0)} km/h`,
      };
  }, [dashboard?.stats.avgSpeed, dashboard?.stats.totalDurationSeconds, vehicles]);

  const summaryTiles = [
    {label: 'Vehicles', value: String(fleetTotals.vehicleCount)},
    {label: 'Trips', value: String(fleetTotals.totalTrips)},
    {label: 'Total km', value: fleetTotals.totalDistance},
    {label: 'Total time', value: fleetTotals.totalDuration},
    {label: 'Avg speed', value: fleetTotals.avgSpeed},
    {label: 'Avg score', value: String(fleetTotals.averageScore)},
  ];

  return (
    <SafeAreaView className="flex-1" style={{backgroundColor: theme.screen}}>
      <ScrollView
        contentContainerStyle={{paddingHorizontal: 20, paddingTop: 12, paddingBottom: 168}}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void fetchDashboard()} tintColor={theme.accent} />}>
        <View className="mb-[18px] flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text style={{color: theme.text, ...theme.typography.pageTitle}}>Garage</Text>
            <Text className="mt-1" style={{color: theme.textSubtle, ...theme.typography.body}}>
              Vehicles, trip health, and readiness in one place
            </Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('AddVehicle')}
            className="flex-row items-center rounded-[18px] px-[14px] py-3"
            style={{
              backgroundColor: theme.accent,
            }}>
            <Ionicons name="add" size={18} color={theme.onAccent} />
            <Text className="ml-1.5" style={{color: theme.onAccent, ...theme.typography.caption, fontWeight: '800'}}>
              Add
            </Text>
          </Pressable>
        </View>

        {dashboardError ? (
          <View
            className="mb-4 rounded-3xl border p-4"
            style={{
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            }}>
            <View className="flex-row items-start">
              <Ionicons name="cloud-offline-outline" size={18} color={theme.danger} style={{marginTop: 2, marginRight: 10}} />
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
            <SkeletonBlock height={300} radius={30} style={{marginBottom: 16}} />
            <SkeletonBlock height={188} radius={26} style={{marginBottom: 14}} />
            <SkeletonBlock height={188} radius={26} />
          </View>
        ) : null}

        {!loading && featuredVehicle ? (
        <View
          className="mb-4 overflow-hidden rounded-[30px] border p-[18px]"
          style={{
            backgroundColor: theme.cardSoft,
            borderColor: theme.cardBorder,
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

          <View className="mb-[18px] flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text style={{color: theme.textSubtle, ...theme.typography.caption, fontWeight: '700'}}>FLEET OVERVIEW</Text>
              <Text className="mt-1.5" numberOfLines={2} style={{color: theme.text, fontSize: 24, fontWeight: '800'}}>
                {fleetTotals.vehicleCount} vehicles connected
              </Text>
              <Text className="mt-1" numberOfLines={2} style={{color: theme.textMuted, ...theme.typography.body}}>
                Active vehicle: {featuredVehicle.name} • {featuredVehicle.plate}
              </Text>
            </View>

            <View
              className="size-[86px] items-center justify-center rounded-3xl border"
              style={{
                backgroundColor: theme.card,
                borderColor: theme.cardBorder,
              }}>
              <Ionicons name="car-sport" size={40} color={theme.text} />
            </View>
          </View>

          <View
            className="mb-[14px] rounded-3xl border p-4"
            style={{
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            }}>
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-3">
                <Text style={{color: theme.textSubtle, ...theme.typography.caption}}>Garage highlight</Text>
                <Text className="mt-1" style={{color: theme.text, fontSize: 18, fontWeight: '800'}}>
                  Fleet health at a glance
                </Text>
                <Text className="mt-1.5" style={{color: theme.textMuted, ...theme.typography.body}}>
                  Combined trip, time, and score signals across every connected vehicle.
                </Text>
              </View>
              <View
                className="min-w-[88px] items-center rounded-[18px] px-3 py-2.5"
                style={{
                  backgroundColor: theme.accentMuted,
                }}>
                <Text style={{color: theme.accent, ...theme.typography.caption, fontWeight: '700'}}>Avg score</Text>
                <Text className="mt-[3px]" style={{color: theme.accent, fontSize: 20, fontWeight: '800'}}>
                  {fleetTotals.averageScore}
                </Text>
              </View>
            </View>
          </View>

          <View className="flex-row flex-wrap justify-between">
            {summaryTiles.map((item, index) => (
              <View
                key={item.label}
                className="mb-2.5 min-h-[88px] w-[31.5%] rounded-[20px] border px-3 py-[14px]"
                style={{
                  backgroundColor: theme.card,
                  borderColor: theme.cardBorder,
                }}>
                <Text className="mb-2" numberOfLines={1} style={{color: theme.textSubtle, ...theme.typography.caption}}>
                  {item.label}
                </Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  style={{color: theme.text, fontSize: 20, fontWeight: '800'}}>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>
        </View>
        ) : !loading ? (
          <View
            className="mb-4 rounded-3xl border p-5"
            style={{
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            }}>
            <Text style={{color: theme.text, ...theme.typography.sectionTitle}}>No vehicles yet</Text>
            <Text className="mt-1.5" style={{color: theme.textSubtle, ...theme.typography.body}}>
              Add your first vehicle to start tracking trips and live telemetry.
            </Text>
            <Pressable
              onPress={() => navigation.navigate('AddVehicle')}
              className="mt-[14px] self-start rounded-[14px] px-[14px] py-2.5"
              style={{
                backgroundColor: theme.accent,
              }}>
              <Text style={{color: theme.onAccent, ...theme.typography.caption, fontWeight: '800'}}>
                Add Vehicle
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View className="mb-3 flex-row items-center justify-between">
          <Text style={{color: theme.text, ...theme.typography.sectionTitle, fontSize: 16}}>Your Fleet</Text>
          <Text style={{color: theme.textSubtle, ...theme.typography.caption}}>
            {vehicles.length} vehicle{vehicles.length > 1 ? 's' : ''}
          </Text>
        </View>

        {vehicles.map((vehicle, index) => (
          <Pressable
            key={vehicle.id}
            onPress={() => navigation.navigate('VehicleAnalytics', {vehicleId: vehicle.id})}
            className="mb-[14px] overflow-hidden rounded-[26px] border p-4"
            style={{
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            }}>
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                top: 24,
                bottom: 24,
                width: 4,
                borderTopRightRadius: 4,
                borderBottomRightRadius: 4,
                backgroundColor: vehicle.isActive ? theme.accent : theme.success,
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                width: 170,
                height: 170,
                borderRadius: 85,
                backgroundColor: index === 0 ? theme.accentMuted : 'rgba(15,157,88,0.08)',
                right: -50,
                top: -30,
              }}
            />

            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16}}>
              <View style={{flex: 1, paddingRight: 12}}>
                <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
                  <Text style={{color: theme.text, fontSize: 19, fontWeight: '800'}}>{vehicle.name}</Text>
                  {vehicle.isActive ? (
                    <View
                      style={{
                        marginLeft: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 999,
                        backgroundColor: theme.accentMuted,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}>
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: theme.accent,
                          marginRight: 6,
                        }}
                      />
                      <Text
                        style={{
                          color: theme.accent,
                          ...theme.typography.caption,
                          fontWeight: '800',
                        }}>
                        Active
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text numberOfLines={1} style={{color: theme.textMuted, ...theme.typography.body}}>
                  {vehicle.fuelType} • {vehicle.plate}
                </Text>
                <Text style={{color: theme.textSubtle, ...theme.typography.caption, marginTop: 4}}>
                  Last trip {vehicle.lastTrip}
                </Text>
              </View>

              <View
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.cardSoft,
                  borderColor: theme.cardBorder,
                  borderWidth: 1,
                }}>
                <Ionicons name={index === 1 ? 'car' : 'car-sport'} size={36} color={theme.text} />
              </View>
            </View>

            <View className="mb-3 flex-row justify-between">
              {[
                {label: 'Score', value: String(vehicle.score), tone: theme.accent, bg: theme.accentMuted},
                {label: 'Time', value: vehicle.totalDuration, tone: theme.text, bg: theme.cardSoft},
                {label: 'Speed', value: vehicle.avgSpeed, tone: theme.text, bg: theme.cardSoft},
              ].map((item) => (
                <View
                  key={item.label}
                  className="w-[31.5%] rounded-[18px] border px-2.5 py-3"
                  style={{
                    backgroundColor: item.bg,
                    borderColor: theme.cardBorder,
                  }}>
                  <Text className="mb-[5px]" style={{color: theme.textSubtle, ...theme.typography.caption}}>{item.label}</Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.82}
                    style={{color: item.tone, fontSize: 18, fontWeight: '800'}}>
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>

            <View className="flex-row flex-wrap justify-between">
              {[
                {label: 'Distance', value: vehicle.distance},
                {label: 'Trips logged', value: String(vehicle.trips)},
                {label: 'Mileage', value: vehicle.mileage},
                {label: 'Fuel type', value: vehicle.fuelType},
              ].map((item, metricIndex) => (
                <View
                  key={item.label}
                  className="w-[31.5%] rounded-[18px] border px-2.5 py-3"
                  style={{
                    backgroundColor: theme.cardSoft,
                    borderColor: theme.cardBorder,
                  }}>
                  <Text className="mb-[5px]" numberOfLines={1} style={{color: theme.textSubtle, ...theme.typography.caption}}>
                    {item.label}
                  </Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                    style={{
                      color: theme.text,
                      fontSize: 16,
                      fontWeight: '800',
                    }}>
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
          </Pressable>
        ))}

        <Pressable
          onPress={() => navigation.navigate('AddVehicle')}
          className="mb-3 mt-0.5 flex-row items-center justify-center rounded-3xl border py-[18px]"
          style={{
            backgroundColor: theme.card,
            borderColor: theme.cardBorder,
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
