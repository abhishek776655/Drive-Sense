import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Platform, ScrollView, Text, TouchableOpacity, View, useWindowDimensions} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAppTheme} from '../theme/appTheme';
import {useAppSidebar} from './AppSidebar';
import {SmoothnessGauge} from './SmoothnessGauge';

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
  latestAcceleration: number;
  isStarted: boolean;
  isPaused?: boolean;
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
  pauseTrip?: () => void | Promise<void>;
  endTrip?: () => void | Promise<void>;
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
  permissionState?: 'pending' | 'granted' | 'denied';
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

/** One radius scale for the whole surface. Anything outside these three is a bug. */
const RADIUS = {sm: 16, md: 20, lg: 28} as const;
/** Minimum comfortable touch target. Non-negotiable in a moving vehicle. */
const HIT = 44;
/** CustomTabBar is absolutely positioned: bottom 22 + height 76. */
const TAB_BAR_CLEARANCE = 106;
const ACTION_BAR_HEIGHT = 52;
/** Scroll must clear the sticky action bar and the tab bar sitting on top of it. */
const SCROLL_BOTTOM_INSET = TAB_BAR_CLEARANCE + ACTION_BAR_HEIGHT + 16;

const CARDINALS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

const toCardinal = (headingDeg: number) => {
  const normalized = ((headingDeg % 360) + 360) % 360;
  return CARDINALS[Math.round(normalized / 22.5) % 16];
};

/** Field names are for logs. These are for people. */
const DIAGNOSTIC_LABELS: Record<string, string> = {
  recorded_at: 'Last fix',
  provider: 'Source',
  sync: 'Sync',
  fuel_used_liters: 'Fuel used',
  avg_speed_mps: 'Average speed',
  max_speed_mps: 'Top speed',
  accuracy_m: 'GPS accuracy',
  accepted_events: 'Events synced',
  pending_points: 'Points queued',
  pending_events: 'Events queued',
};

const PROVIDER_LABELS: Record<string, string> = {
  device_gps: 'Device GPS',
  mock: 'Simulated',
};

const formatDiagnostic = (label: string, value: string) => {
  if (label === 'avg_speed_mps' || label === 'max_speed_mps') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? `${(parsed * 3.6).toFixed(1)} km/h` : value;
  }
  if (label === 'fuel_used_liters') {
    return `${value} L`;
  }
  if (label === 'provider') {
    return PROVIDER_LABELS[value] ?? value;
  }
  return value;
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
  const {openSidebar} = useAppSidebar();
  const insets = useSafeAreaInsets();
  const {height: windowHeight} = useWindowDimensions();
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [hideCompletedTripCard, setHideCompletedTripCard] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);

  /** Map keeps the dominant slice of the first screenful; telemetry scrolls up over it. */
  const mapHeight = Math.round(Math.min(440, Math.max(280, windowHeight * 0.46)));

  const showCompletedTripCard = Boolean(data.completedTrip && !hideCompletedTripCard);
  const isLive = data.isStarted && !data.hasEnded;
  const isMoving = data.currentPoint.is_moving;
  const liveBadge = data.hasEnded ? 'Ready' : isMoving ? 'Moving' : 'Idle';
  const syncTone =
    data.syncState === 'recording' || data.syncState === 'saved'
      ? theme.success
      : data.syncState === 'syncing'
        ? theme.warning
        : data.syncState === 'error'
          ? theme.danger
          : theme.textSubtle;

  /** Motion magnitude is ~9.8 m/s² at standstill (gravity). Showing it parked reads as garbage data. */
  const motionLabel = isMoving ? data.paceDelta : 'No motion detected';
  const headingLabel = isMoving ? `${data.heading} ${toCardinal(data.currentPoint.heading_deg)}` : '—';

  const tiles = useMemo(
    () => [
      {
        label: 'Distance',
        value: data.isStarted ? data.distance : '—',
        icon: 'navigate' as const,
      },
      {
        label: 'Duration',
        value: data.isStarted ? data.duration : '—',
        icon: 'time' as const,
      },
      {
        label: 'GPS accuracy',
        value: data.hasLiveLocation ? `${data.currentPoint.accuracy_m.toFixed(1)} m` : '—',
        icon: 'locate' as const,
      },
    ],
    [data.currentPoint.accuracy_m, data.distance, data.duration, data.hasLiveLocation, data.isStarted],
  );

  const diagnostics = useMemo(
    () =>
      [...data.timeline, ...data.stats].map((item) => ({
        label: DIAGNOSTIC_LABELS[item.label] ?? item.label.replace(/_/g, ' '),
        value: formatDiagnostic(item.label, item.value),
      })),
    [data.stats, data.timeline],
  );

  useEffect(() => {
    if (!data.completedTrip) {
      setShowSavedToast(false);
      setHideCompletedTripCard(false);
      return;
    }

    setShowSavedToast(true);
    setHideCompletedTripCard(false);
    const toastTimeout = setTimeout(() => {
      setShowSavedToast(false);
    }, 3200);
    const cardTimeout = setTimeout(() => {
      setHideCompletedTripCard(true);
    }, 6500);

    return () => {
      clearTimeout(toastTimeout);
      clearTimeout(cardTimeout);
    };
  }, [data.completedTrip]);

  const openDiagnostics = () => {
    setShowDiagnostics(true);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({animated: true});
    });
  };

  const mapControl = (
    key: string,
    label: string,
    active: boolean,
    onPress: () => void,
    icon?: keyof typeof Ionicons.glyphMap,
  ) => (
    <TouchableOpacity
      key={key}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{selected: active}}
      style={{
        minWidth: HIT,
        height: HIT,
        paddingHorizontal: 12,
        marginBottom: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: RADIUS.sm,
        // Translucent so the map reads through the control strip.
        backgroundColor: active ? theme.overlayActive : theme.overlay,
        borderWidth: 1,
        borderColor: active ? theme.overlayActive : theme.overlayBorder,
        shadowColor: '#000000',
        shadowOpacity: 0.16,
        shadowRadius: 8,
        shadowOffset: {width: 0, height: 4},
        elevation: 4,
      }}>
      {icon ? (
        <Ionicons name={icon} size={18} color={active ? theme.onAccent : theme.text} />
      ) : (
        <Text
          style={{
            color: active ? theme.onAccent : theme.text,
            ...theme.typography.caption,
            fontWeight: '800',
          }}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );

  const primaryAction = isLive
    ? {
        label: 'End Trip',
        icon: 'stop-circle' as const,
        onPress: () => void data.endTrip?.(),
        destructive: true,
      }
    : {
        label: data.hasEnded ? 'Start New Trip' : 'Start Trip',
        icon: 'play' as const,
        onPress: () => void data.startTrip(),
        destructive: false,
      };

  return (
    <SafeAreaView className="flex-1" style={{backgroundColor: theme.screen}}>
      {showSavedToast && data.completedTrip ? (
        <View
          accessibilityLiveRegion="polite"
          style={{
            position: 'absolute',
            top: insets.top + 12,
            left: 20,
            right: 20,
            zIndex: 30,
            backgroundColor: theme.success,
            borderRadius: RADIUS.md,
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
            <Text
              style={{
                color: theme.onSuccess,
                ...theme.typography.body,
                fontWeight: '800',
              }}>
              Trip complete
            </Text>
            <Text
              style={{
                color: theme.onSuccessMuted,
                ...theme.typography.caption,
                marginTop: 2,
              }}>
              Saved to history with {data.completedTrip.distanceLabel} in {data.completedTrip.durationLabel}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Header stays compact — the map is the content, not this. */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <TouchableOpacity
          onPress={openSidebar}
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          style={{
            width: HIT,
            height: HIT,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: RADIUS.sm,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.cardBorder,
          }}>
          <Ionicons name="menu" size={20} color={theme.text} />
        </TouchableOpacity>
        <View style={{alignItems: 'center', flex: 1, paddingHorizontal: 8}}>
          <Text
            numberOfLines={1}
            style={{
              color: theme.text,
              ...theme.typography.pageTitle,
              fontSize: 22,
              lineHeight: 26,
            }}>
            Live Feed
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: theme.textSubtle,
              ...theme.typography.caption,
              marginTop: 2,
            }}>
            {data.vehicleName} • {data.state}
          </Text>
        </View>
        <TouchableOpacity
          onPress={openDiagnostics}
          accessibilityRole="button"
          accessibilityLabel="Show tracking diagnostics"
          style={{
            width: HIT,
            height: HIT,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: RADIUS.sm,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.cardBorder,
          }}>
          <Ionicons name="pulse-outline" size={20} color={theme.text} />
          <View
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: syncTone,
            }}
          />
        </TouchableOpacity>
      </View>

      {/* One page scroll: map first, telemetry flows underneath with no inner scroll container. */}
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingHorizontal: 20, paddingBottom: SCROLL_BOTTOM_INSET}}>
        <View
          style={{
            height: mapHeight,
            borderRadius: RADIUS.lg,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: theme.cardBorder,
            backgroundColor: theme.card,
          }}>
          {mapContent}

          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              right: 12,
              flexDirection: 'row',
              alignItems: 'flex-start',
            }}>
            <View
              style={{
                flexShrink: 1,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: RADIUS.sm,
                backgroundColor: theme.card,
                borderWidth: 1,
                borderColor: theme.cardBorder,
              }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: syncTone,
                  marginRight: 8,
                }}
              />
              <Text
                numberOfLines={1}
                style={{
                  color: theme.text,
                  ...theme.typography.caption,
                  fontWeight: '800',
                }}>
                {liveBadge}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  color: theme.textSubtle,
                  ...theme.typography.caption,
                  marginLeft: 8,
                }}>
                {data.syncLabel}
              </Text>
            </View>
            <View style={{flex: 1}} />
            <View style={{alignItems: 'flex-end'}}>
              {onToggleFollowMode ? mapControl('follow', 'Follow', isFollowMode, onToggleFollowMode) : null}
              {onToggle3DMode ? mapControl('3d', '3D', is3DMode, onToggle3DMode) : null}
              {onCenterCurrentLocation
                ? mapControl('recenter', 'Recenter on vehicle', false, onCenterCurrentLocation, 'locate')
                : null}
            </View>
          </View>

          {/* Permission denial has its own banner from the map screen — do not stack two hints. */}
          {!data.hasLiveLocation && data.permissionState !== 'denied' ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                bottom: 12,
                left: 12,
                right: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: RADIUS.sm,
                backgroundColor: theme.overlay,
                borderWidth: 1,
                borderColor: theme.overlayBorder,
              }}>
              <Text style={{color: theme.textSubtle, ...theme.typography.caption}}>
                Waiting for a GPS fix before the live position appears.
              </Text>
            </View>
          ) : null}
        </View>

        {/* Telemetry block: hero reading plus its supporting tiles, held in one container. */}
        <View
          style={{
            marginTop: 14,
            marginBottom: 14,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.cardBorder,
            borderRadius: RADIUS.lg,
            padding: 16,
          }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              marginBottom: 16,
            }}>
            <View style={{flex: 1}}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{
                  color: theme.text,
                  ...theme.typography.scoreValue,
                  fontSize: 44,
                  // scoreValue ships a 1.03 line-height ratio; Nunito ExtraBold clips its own
                  // ascenders at that. 1.2 gives the glyphs room.
                  lineHeight: 53,
                  includeFontPadding: false,
                }}>
                {data.speed}
              </Text>
              <Text
                style={{
                  color: theme.textSubtle,
                  ...theme.typography.caption,
                  marginTop: 2,
                }}>
                km/h current speed
              </Text>
            </View>
            <View style={{alignItems: 'flex-end', paddingLeft: 12}}>
              <Text
                numberOfLines={1}
                style={{
                  color: theme.text,
                  ...theme.typography.metricValue,
                  fontSize: 22,
                  lineHeight: 28,
                }}>
                {headingLabel}
              </Text>
              <Text
                style={{
                  color: theme.textSubtle,
                  ...theme.typography.caption,
                }}>
                Heading
              </Text>
              <Text
                style={{
                  color: isMoving ? theme.accent : theme.textSubtle,
                  ...theme.typography.caption,
                  fontWeight: '700',
                  marginTop: 6,
                }}>
                {motionLabel}
              </Text>
              {isLive ? (
                <View style={{marginTop: 8}}>
                  <SmoothnessGauge magnitude={data.latestAcceleration} />
                </View>
              ) : null}
            </View>
          </View>

          <View style={{flexDirection: 'row', gap: 10}}>
            {tiles.map((item) => (
              <View
                key={item.label}
                style={{
                  flex: 1,
                  backgroundColor: theme.cardSoft,
                  borderWidth: 1,
                  borderColor: theme.cardBorder,
                  borderRadius: RADIUS.md,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                }}>
                <Ionicons name={item.icon} size={15} color={theme.textSubtle} />
                <Text
                  numberOfLines={1}
                  style={{
                    color: theme.text,
                    ...theme.typography.body,
                    fontWeight: '800',
                    marginTop: 8,
                  }}>
                  {item.value}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    color: theme.textSubtle,
                    ...theme.typography.caption,
                    marginTop: 2,
                  }}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {!data.isStarted && !data.hasEnded ? (
          <View
            style={{
              backgroundColor: theme.cardSoft,
              borderWidth: 1,
              borderColor: theme.cardBorder,
              borderRadius: RADIUS.md,
              padding: 14,
              marginBottom: 14,
            }}>
            <Text
              style={{
                color: theme.text,
                ...theme.typography.body,
                fontWeight: '800',
              }}>
              {data.prominentStatus}
            </Text>
            <Text
              style={{
                color: theme.textSubtle,
                ...theme.typography.caption,
                marginTop: 4,
              }}>
              Tracking auto-starts when movement is detected, or start it now.
            </Text>
          </View>
        ) : null}

        {showCompletedTripCard && data.completedTrip ? (
          <View
            style={{
              backgroundColor: theme.successSoft,
              borderWidth: 1,
              borderColor: theme.successMuted,
              borderRadius: RADIUS.md,
              padding: 14,
              marginBottom: 14,
            }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 10,
              }}>
              <Ionicons name="checkmark-circle" size={20} color={theme.success} />
              <View style={{flex: 1, marginLeft: 8}}>
                <Text
                  style={{
                    color: theme.text,
                    ...theme.typography.body,
                    fontWeight: '800',
                  }}>
                  Trip saved
                </Text>
                <Text
                  style={{
                    color: theme.textSubtle,
                    ...theme.typography.caption,
                    marginTop: 2,
                  }}>
                  {new Date(data.completedTrip.endedAt).toLocaleTimeString('en-IN', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}{' '}
                  • ready for the next drive
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setHideCompletedTripCard(true)}
                accessibilityRole="button"
                accessibilityLabel="Dismiss trip summary"
                style={{
                  width: HIT,
                  height: HIT,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name="close" size={18} color={theme.success} />
              </TouchableOpacity>
            </View>
            <View style={{flexDirection: 'row', gap: 10}}>
              {[
                {
                  label: 'Distance',
                  value: data.completedTrip.distanceLabel,
                },
                {
                  label: 'Duration',
                  value: data.completedTrip.durationLabel,
                },
                {
                  label: 'Events',
                  value: String(data.completedTrip.eventCount),
                },
              ].map((item) => (
                <View
                  key={item.label}
                  style={{
                    flex: 1,
                    backgroundColor: theme.card,
                    borderWidth: 1,
                    borderColor: theme.cardBorder,
                    borderRadius: RADIUS.sm,
                    paddingHorizontal: 10,
                    paddingVertical: 10,
                  }}>
                  <Text
                    style={{
                      color: theme.textSubtle,
                      ...theme.typography.caption,
                    }}>
                    {item.label}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: theme.text,
                      ...theme.typography.body,
                      fontWeight: '800',
                      marginTop: 4,
                    }}>
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {data.syncError ? (
          <View
            style={{
              backgroundColor: theme.dangerSoft,
              borderWidth: 1,
              borderColor: theme.danger,
              borderRadius: RADIUS.md,
              padding: 12,
              marginBottom: 14,
            }}>
            <Text
              style={{
                color: theme.danger,
                ...theme.typography.caption,
                fontWeight: '700',
              }}>
              {data.syncError}
            </Text>
          </View>
        ) : null}

        {/* Everything a driver does not need mid-drive lives behind this disclosure. */}
        <TouchableOpacity
          onPress={() => setShowDiagnostics((previous) => !previous)}
          accessibilityRole="button"
          accessibilityLabel="Diagnostics"
          accessibilityState={{expanded: showDiagnostics}}
          style={{
            minHeight: HIT,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: theme.cardSoft,
            borderWidth: 1,
            borderColor: theme.cardBorder,
            borderRadius: RADIUS.md,
            paddingHorizontal: 14,
            paddingVertical: 12,
          }}>
          <View>
            <Text
              style={{
                color: theme.text,
                ...theme.typography.body,
                fontWeight: '800',
              }}>
              Diagnostics
            </Text>
            <Text
              style={{
                color: theme.textSubtle,
                ...theme.typography.caption,
                marginTop: 2,
              }}>
              {data.acceptedPoints} points • {data.acceptedEvents} events synced
            </Text>
          </View>
          <Ionicons name={showDiagnostics ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSubtle} />
        </TouchableOpacity>

        {showDiagnostics ? (
          <View
            style={{
              marginTop: 10,
              backgroundColor: theme.cardSoft,
              borderWidth: 1,
              borderColor: theme.cardBorder,
              borderRadius: RADIUS.md,
              // Uniform box padding; row spacing comes from rowGap so the last row adds nothing.
              padding: 14,
            }}>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                rowGap: 14,
              }}>
              {diagnostics.map((item) => (
                <View key={item.label} style={{width: '48.5%'}}>
                  <Text
                    style={{
                      color: theme.textSubtle,
                      ...theme.typography.caption,
                    }}>
                    {item.label}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: theme.text,
                      ...theme.typography.body,
                      fontWeight: '800',
                      marginTop: 3,
                    }}>
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
            <View
              style={{
                height: 1,
                backgroundColor: theme.cardBorder,
                marginTop: 14,
                marginBottom: 12,
              }}
            />
            <Text style={{color: theme.textSubtle, ...theme.typography.caption}}>
              Trip {data.trip_id.slice(0, 8)} • started {data.start_time.slice(11, 16)}
              {data.hasLiveLocation
                ? ` • ${data.currentPoint.latitude.toFixed(4)}, ${data.currentPoint.longitude.toFixed(4)}`
                : ''}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* One primary action, pinned to the bottom, never scrolled away. */}
      <View
        style={{
          position: 'absolute',
          left: 20,
          right: 20,
          bottom: TAB_BAR_CLEARANCE + (Platform.OS === 'android' ? insets.bottom : 0),
          flexDirection: 'row',
          gap: 10,
        }}>
        {isLive ? (
          <TouchableOpacity
            onPress={() => void data.pauseTrip?.()}
            accessibilityRole="button"
            accessibilityLabel={data.isPaused ? 'Resume trip' : 'Pause trip'}
            style={{
              width: 96,
              height: ACTION_BAR_HEIGHT,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              borderRadius: RADIUS.md,
              // Paused is the state that needs a loud way out, so Resume fills solid accent.
              // accentMuted is a 6% wash — never use it on a control.
              backgroundColor: data.isPaused ? theme.accent : theme.card,
              borderWidth: 1,
              borderColor: data.isPaused ? theme.accent : theme.cardBorder,
              shadowColor: '#000000',
              shadowOpacity: 0.12,
              shadowRadius: 10,
              shadowOffset: {width: 0, height: 4},
              elevation: 4,
            }}>
            <Ionicons
              name={data.isPaused ? 'play' : 'pause'}
              size={16}
              color={data.isPaused ? theme.onAccent : theme.text}
            />
            <Text
              style={{
                color: data.isPaused ? theme.onAccent : theme.text,
                ...theme.typography.caption,
                fontWeight: '800',
                marginLeft: 6,
              }}>
              {data.isPaused ? 'Resume' : 'Pause'}
            </Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={primaryAction.onPress}
          accessibilityRole="button"
          accessibilityLabel={primaryAction.label}
          style={{
            flex: 1,
            height: ACTION_BAR_HEIGHT,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: RADIUS.md,
            // Solid fill in both states — the primary action never reads as a ghost button.
            backgroundColor: primaryAction.destructive ? theme.danger : theme.accent,
            borderWidth: 1,
            borderColor: primaryAction.destructive ? theme.danger : theme.accent,
            shadowColor: primaryAction.destructive ? theme.danger : theme.accent,
            shadowOpacity: 0.24,
            shadowRadius: 12,
            shadowOffset: {width: 0, height: 6},
            elevation: 5,
          }}>
          <Ionicons
            name={primaryAction.icon}
            size={18}
            color={primaryAction.destructive ? theme.onDanger : theme.onAccent}
          />
          <Text
            style={{
              color: primaryAction.destructive ? theme.onDanger : theme.onAccent,
              ...theme.typography.body,
              fontWeight: '800',
              marginLeft: 8,
            }}>
            {primaryAction.label}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};
