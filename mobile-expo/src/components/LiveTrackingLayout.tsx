import React, {useEffect, useState} from 'react';
import {ScrollView, Text, TouchableOpacity, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAppTheme} from '../theme/appTheme';

type LiveTrackingData = {
  trip_id: string;
  state: string;
  start_time: string;
  vehicleName: string;
  statusLabel: string;
  speed: number;
  distance: string;
  duration: string;
  currentLocation: string;
  heading: string;
  paceDelta: string;
  isStarted: boolean;
  hasEnded?: boolean;
  hasLiveLocation: boolean;
  prominentStatus: string;
  syncLabel: string;
  syncState: 'idle' | 'starting' | 'recording' | 'syncing' | 'local_only' | 'saved' | 'error';
  acceptedPoints: number;
  acceptedEvents: number;
  syncError: string | null;
  completedTrip: {
    endedAt: string;
    distanceLabel: string;
    durationLabel: string;
    eventCount: number;
  } | null;
  startTrip: () => void | Promise<void>;
  currentPoint: {
    recorded_at: string;
    latitude: number;
    longitude: number;
    speed_mps: number;
    heading_deg: number;
    accuracy_m: number;
    altitude_m: number;
    is_moving: boolean;
    provider: string;
  };
  stats: Array<{label: string; value: string}>;
  timeline: Array<{label: string; value: string}>;
};

type Props = {
  data: LiveTrackingData;
  mapContent: React.ReactNode;
  is3DMode?: boolean;
  isFollowMode?: boolean;
  onToggle3DMode?: () => void;
  onToggleFollowMode?: () => void;
  onCenterCurrentLocation?: () => void;
};

export const LiveTrackingLayout: React.FC<Props> = ({
  data,
  mapContent,
  is3DMode = false,
  isFollowMode = true,
  onToggle3DMode,
  onToggleFollowMode,
  onCenterCurrentLocation,
}) => {
  const theme = useAppTheme();
  const [showSavedToast, setShowSavedToast] = useState(false);
  const liveBadge = data.currentPoint.is_moving ? 'Moving' : 'Idle';
  const syncTone =
    data.syncState === 'recording'
      ? '#34D399'
      : data.syncState === 'syncing'
        ? '#FBBF24'
        : data.syncState === 'saved'
          ? '#34D399'
        : data.syncState === 'error'
          ? '#F87171'
          : '#93C5FD';

  useEffect(() => {
    if (!data.completedTrip) {
      setShowSavedToast(false);
      return;
    }

    setShowSavedToast(true);
    const timeout = setTimeout(() => {
      setShowSavedToast(false);
    }, 3200);

    return () => clearTimeout(timeout);
  }, [data.completedTrip]);

  return (
    <SafeAreaView className="flex-1" style={{backgroundColor: theme.screen}}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -80,
          right: -40,
          width: 220,
          height: 220,
          borderRadius: 110,
          backgroundColor: theme.accentMuted,
          opacity: 0.8,
        }}
      />
      {showSavedToast && data.completedTrip ? (
        <View
          style={{
            position: 'absolute',
            top: 16,
            left: 20,
            right: 20,
            zIndex: 20,
            backgroundColor: theme.success,
            borderRadius: 18,
            paddingHorizontal: 14,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: '#000000',
            shadowOpacity: 0.14,
            shadowRadius: 14,
            shadowOffset: {width: 0, height: 8},
            elevation: 5,
          }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: 'rgba(255,255,255,0.18)',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
            }}>
            <Ionicons name="checkmark" size={18} color={theme.onSuccess} />
          </View>
          <View style={{flex: 1}}>
            <Text style={{color: theme.onSuccess, ...theme.typography.body, fontWeight: '800'}}>
              Trip complete
            </Text>
            <Text style={{color: theme.onSuccessMuted, ...theme.typography.caption, marginTop: 2}}>
              Saved to history with {data.completedTrip.distanceLabel} in {data.completedTrip.durationLabel}
            </Text>
          </View>
        </View>
      ) : null}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{paddingHorizontal: 20, paddingTop: 12, paddingBottom: 132}}
        showsVerticalScrollIndicator={false}>
        <View className="mb-[18px] flex-row items-center justify-between">
          <TouchableOpacity
            className="size-[42px] items-center justify-center rounded-2xl border"
            style={{
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            }}>
            <Ionicons name="analytics" size={18} color={theme.text} />
          </TouchableOpacity>
          <View className="items-center">
            <Text style={{color: theme.text, ...theme.typography.pageTitle, fontSize: 22, lineHeight: 26}}>Live Feed</Text>
            <Text className="mt-0.5" style={{color: theme.textSubtle, ...theme.typography.caption}}>{data.vehicleName} • {data.state}</Text>
          </View>
          <TouchableOpacity
            className="size-[42px] items-center justify-center rounded-2xl border"
            style={{
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            }}>
            <Ionicons name="radio-outline" size={18} color={theme.text} />
          </TouchableOpacity>
        </View>

        <View
          className="mb-[14px] rounded-3xl border px-4 py-[14px]"
          style={{
            backgroundColor: theme.card,
            borderColor: theme.cardBorder,
          }}>
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <View className="mb-2.5 flex-row items-center">
                <View
                  className="mr-2 flex-row items-center rounded-full px-2.5 py-1.5"
                  style={{
                    backgroundColor: theme.cardSoft,
                  }}>
                  <View className="mr-[7px] size-2 rounded-full" style={{backgroundColor: syncTone}} />
                  <Text style={{color: theme.text, ...theme.typography.caption, fontWeight: '700'}}>{liveBadge}</Text>
                </View>
                <Text style={{color: theme.textSubtle, ...theme.typography.caption}}>{data.syncLabel}</Text>
              </View>
              <Text style={{color: theme.text, ...theme.typography.sectionTitle, fontSize: 20, lineHeight: 24}}>
                {data.prominentStatus}
              </Text>
              <Text className="mt-1" style={{color: theme.textSubtle, ...theme.typography.caption}}>
                {data.hasEnded
                  ? `${data.acceptedPoints} points • ${data.acceptedEvents} events saved`
                  : `${data.acceptedPoints} points synced`}
              </Text>
              {!data.isStarted && !data.hasEnded ? (
                <TouchableOpacity
                  onPress={() => void data.startTrip()}
                  className="mt-[14px] self-start rounded-[14px] border px-4 py-2.5"
                  style={{
                    backgroundColor: theme.accent,
                    borderColor: theme.accent,
                    shadowColor: theme.accent,
                    shadowOpacity: 0.18,
                    shadowRadius: 10,
                    shadowOffset: {width: 0, height: 6},
                    elevation: 4,
                  }}>
                  <Text style={{color: theme.onAccent, ...theme.typography.body, fontWeight: '800'}}>Start Trip</Text>
                </TouchableOpacity>
              ) : null}
              {data.syncError ? (
                <Text className="mt-1.5" style={{color: theme.danger, ...theme.typography.caption}}>
                  {data.syncError}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {data.completedTrip ? (
          <View
            className="mb-[14px] rounded-[22px] border p-4"
            style={{
              backgroundColor: theme.successSoft,
              borderColor: theme.successMuted,
            }}>
            <View className="mb-2.5 flex-row items-center">
              <View
                className="mr-2.5 size-[34px] items-center justify-center rounded-full"
                style={{
                  backgroundColor: theme.successMuted,
                }}>
                <Ionicons name="checkmark" size={18} color={theme.success} />
              </View>
              <View className="flex-1">
                <Text style={{color: theme.text, ...theme.typography.sectionTitle}}>Trip saved</Text>
                <Text className="mt-0.5" style={{color: theme.textSubtle, ...theme.typography.caption}}>
                  {new Date(data.completedTrip.endedAt).toLocaleTimeString('en-IN', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })} • ready for the next drive
                </Text>
              </View>
            </View>
            <View className="flex-row justify-between">
              {[
                {label: 'Distance', value: data.completedTrip.distanceLabel},
                {label: 'Duration', value: data.completedTrip.durationLabel},
                {label: 'Events', value: String(data.completedTrip.eventCount)},
              ].map((item) => (
                <View
                  key={item.label}
                  className="w-[31.5%] rounded-2xl border px-2.5 py-2.5"
                  style={{
                    backgroundColor: theme.card,
                    borderColor: theme.cardBorder,
                  }}>
                  <Text className="mb-1" style={{color: theme.textSubtle, ...theme.typography.caption}}>
                    {item.label}
                  </Text>
                  <Text numberOfLines={1} style={{color: theme.text, ...theme.typography.body, fontWeight: '800'}}>
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View
          className="mb-[14px] overflow-hidden rounded-[28px] border"
          style={{
            backgroundColor: theme.card,
            borderColor: theme.cardBorder,
          }}>
          <View className="px-4 pb-2.5 pt-4">
            <View className="mb-2 flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text style={{color: theme.text, ...theme.typography.sectionTitle, fontSize: 16}}>Live Map</Text>
                <Text className="mt-0.5" style={{color: theme.textSubtle, ...theme.typography.caption}}>
                  {data.hasLiveLocation
                    ? `latitude ${data.currentPoint.latitude.toFixed(4)} • longitude ${data.currentPoint.longitude.toFixed(4)}`
                    : 'Live map will appear once a GPS fix is available'}
                </Text>
              </View>
              <View className="self-start flex-row items-center">
                {onToggleFollowMode ? (
                  <TouchableOpacity
                    onPress={onToggleFollowMode}
                    className="mr-2 h-8 min-w-[58px] items-center justify-center rounded-full"
                    style={{
                      backgroundColor: isFollowMode ? theme.text : theme.cardSoft,
                    }}>
                    <Text
                      style={{
                        color: isFollowMode ? theme.screen : theme.text,
                        ...theme.typography.caption,
                        fontWeight: '700',
                      }}>
                      Follow
                    </Text>
                  </TouchableOpacity>
                ) : null}
                {onToggle3DMode ? (
                  <TouchableOpacity
                    onPress={onToggle3DMode}
                    className="mr-2 h-8 min-w-[42px] items-center justify-center rounded-full"
                    style={{
                      backgroundColor: is3DMode ? theme.accent : theme.cardSoft,
                    }}>
                    <Text
                      style={{
                        color: is3DMode ? theme.onAccent : theme.text,
                        ...theme.typography.caption,
                        fontWeight: '700',
                      }}>
                      3D
                    </Text>
                  </TouchableOpacity>
                ) : null}
                {onCenterCurrentLocation ? (
                  <TouchableOpacity
                    onPress={onCenterCurrentLocation}
                    className="size-8 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: theme.cardSoft,
                    }}>
                    <Ionicons name="locate" size={15} color={theme.text} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
          <View style={{height: 250}}>{mapContent}</View>
        </View>

        <View
          style={{
            backgroundColor: theme.accent,
            borderRadius: 30,
            padding: 18,
            marginBottom: 14,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.12)',
          }}>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -80,
              right: -50,
              width: 200,
              height: 200,
              borderRadius: 100,
              backgroundColor: 'rgba(255,255,255,0.10)',
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: -60,
              left: -30,
              width: 160,
              height: 160,
              borderRadius: 80,
              backgroundColor: 'rgba(255,255,255,0.08)',
            }}
          />

          <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16}}>
            <View>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <View style={{width: 8, height: 8, borderRadius: 4, backgroundColor: '#34D399', marginRight: 8}} />
                <Text style={{color: '#FFFFFF', ...theme.typography.caption, fontWeight: '700', letterSpacing: 0.8}}>TELEMETRY FEED</Text>
              </View>
              <Text style={{color: 'rgba(255,255,255,0.78)', ...theme.typography.caption, marginTop: 6}}>
                point at {data.currentPoint.recorded_at.slice(11, 19)} • {data.currentLocation}
              </Text>
            </View>
            <View style={{paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)'}}>
              <Text style={{color: '#FFFFFF', ...theme.typography.caption, fontWeight: '700'}}>{liveBadge}</Text>
            </View>
          </View>

          <View style={{flexDirection: 'row', marginBottom: 18}}>
            <View style={{flex: 1}}>
              <Text style={{color: '#FFFFFF', ...theme.typography.scoreValue, fontSize: 42, lineHeight: 44}}>{data.speed}</Text>
              <Text style={{color: 'rgba(255,255,255,0.74)', ...theme.typography.caption}}>km/h current speed</Text>
            </View>
            <View style={{flex: 1, alignItems: 'flex-end'}}>
              <Text style={{color: '#FFFFFF', ...theme.typography.metricValue, fontSize: 22}}>{data.heading}</Text>
              <Text style={{color: 'rgba(255,255,255,0.74)', ...theme.typography.caption}}>heading_deg</Text>
              <Text style={{color: '#CFFAFE', ...theme.typography.caption, fontWeight: '700', marginTop: 8}}>{data.paceDelta}</Text>
            </View>
          </View>

          <View style={{flexDirection: 'row', gap: 10, marginBottom: 16}}>
            {[
              {label: 'Distance', value: data.distance, icon: 'navigate'},
              {label: 'Duration', value: data.duration, icon: 'time'},
              {label: 'Accuracy', value: `${data.currentPoint.accuracy_m.toFixed(1)} m`, icon: 'locate'},
            ].map((item) => (
              <View
                key={item.label}
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(255,255,255,0.10)',
                  borderRadius: 18,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                }}>
                <Ionicons name={item.icon as any} size={15} color="#FFFFFF" />
                <Text style={{color: '#FFFFFF', ...theme.typography.body, fontWeight: '700', marginTop: 8}}>{item.value}</Text>
                <Text style={{color: 'rgba(255,255,255,0.72)', ...theme.typography.caption, marginTop: 2}}>{item.label}</Text>
              </View>
            ))}
          </View>

              <Text style={{color: 'rgba(255,255,255,0.82)', ...theme.typography.caption}}>
            trip_id {data.trip_id.slice(0, 8)} • started {data.start_time.slice(11, 16)} • {data.syncLabel}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: theme.card,
            borderColor: theme.cardBorder,
            borderWidth: 1,
            borderRadius: 26,
            padding: 16,
            marginBottom: 14,
          }}>
          <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14}}>
            <View>
              <Text style={{color: theme.text, ...theme.typography.sectionTitle}}>Live Snapshot</Text>
              <Text style={{color: theme.textSubtle, ...theme.typography.caption, marginTop: 3}}>
                Current trip details and tracking health
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: theme.accentMuted,
              }}>
              <Text style={{color: theme.accent, ...theme.typography.caption, fontWeight: '700'}}>
                {data.state}
              </Text>
            </View>
          </View>

          <View style={{flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 8}}>
            {data.timeline.map((item) => (
              <View
                key={item.label}
                style={{
                  width: '48.5%',
                  backgroundColor: theme.cardSoft,
                  borderColor: theme.cardBorder,
                  borderWidth: 1,
                  borderRadius: 18,
                  paddingHorizontal: 14,
                  paddingVertical: 13,
                  marginBottom: 10,
                }}>
                <Text style={{color: theme.textSubtle, ...theme.typography.caption, marginBottom: 6}}>
                  {item.label.replace(/_/g, ' ')}
                </Text>
                <Text style={{color: theme.text, ...theme.typography.body, fontWeight: '800'}}>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>

          <View
            style={{
              backgroundColor: theme.cardSoft,
              borderColor: theme.cardBorder,
              borderWidth: 1,
              borderRadius: 20,
              padding: 14,
            }}>
            <Text style={{color: theme.text, ...theme.typography.sectionTitle, marginBottom: 10}}>
              Tracking Health
            </Text>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between'}}>
              {data.stats.map((item) => (
                <View
                  key={item.label}
                  style={{
                    width: '48.5%',
                    marginBottom: 12,
                  }}>
                  <Text style={{color: theme.textSubtle, ...theme.typography.caption}}>
                    {item.label.replace(/_/g, ' ')}
                  </Text>
                  <Text style={{color: theme.text, ...theme.typography.body, fontWeight: '800', marginTop: 4}}>
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => void data.startTrip()}
          disabled={data.isStarted}
          style={{
            backgroundColor: data.isStarted ? theme.card : theme.accent,
            borderColor: data.isStarted ? theme.cardBorder : theme.accent,
            borderWidth: 1,
            borderRadius: 22,
            paddingVertical: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8,
          }}>
          <Ionicons name={data.isStarted ? 'pulse' : 'play'} size={18} color={data.isStarted ? theme.accent : theme.onAccent} />
          <Text
            style={{
              color: data.isStarted ? theme.accent : theme.onAccent,
              ...theme.typography.body,
              fontWeight: '800',
              marginLeft: 8,
            }}>
            {data.isStarted ? 'Live Feed Active' : 'Auto Start Ready'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};
