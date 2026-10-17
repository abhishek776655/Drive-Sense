import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import MapView, {Circle, Marker, Polyline} from 'react-native-maps';
import {MapScreenProps} from '../navigation/types';
import {LiveTrackingLayout} from '../components/LiveTrackingLayout';
import {LiveLocationMarker} from '../components/LiveLocationMarker';
import {useAppTheme} from '../theme/appTheme';
import {DARK_MAP_STYLE} from '../theme/mapStyle';
import {useLiveTracking} from '../hooks/useLiveTracking';
import {useDashboardStore} from '../store/dashboardStore';
import {useVehiclePreferencesStore} from '../store/vehiclePreferencesStore';

const normalizeHeading = (value: number) => {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

/** Shortest signed turn from `from` to `to`, in (-180, 180]. */
const shortestHeadingDelta = (from: number, to: number) =>
  ((((normalizeHeading(to) - normalizeHeading(from)) % 360) + 540) % 360) - 180;

const CAMERA_ZOOM_2D = 16.4;
const CAMERA_ZOOM_3D = 19.2;
const CAMERA_ALTITUDE_2D = 760;
const CAMERA_ALTITUDE_3D = 240;
const CAMERA_DURATION_2D = 650;
const CAMERA_DURATION_3D = 900;
/** Below this the GPS course is noise, so the puck keeps its last heading and drops the arrow. */
const HEADING_HOLD_SPEED_MPS = 0.8;

const getLookAheadCoordinate = (
  point: {latitude: number; longitude: number},
  headingDeg: number,
  distanceMeters: number,
) => {
  const headingRad = (normalizeHeading(headingDeg) * Math.PI) / 180;
  const latitudeOffset = (Math.cos(headingRad) * distanceMeters) / 111_320;
  const longitudeOffset = (Math.sin(headingRad) * distanceMeters) / (111_320 * Math.cos((point.latitude * Math.PI) / 180));

  return {
    latitude: point.latitude + latitudeOffset,
    longitude: point.longitude + longitudeOffset,
  };
};

const getRegion = (coordinates: Array<{latitude: number; longitude: number}>) => {
  if (coordinates.length === 0) {
    return {
      latitude: 28.62892,
      longitude: 77.36486,
      latitudeDelta: 0.025,
      longitudeDelta: 0.025,
    };
  }
  const latitudes = coordinates.map((point) => point.latitude);
  const longitudes = coordinates.map((point) => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.025, (maxLat - minLat) * 1.8),
    longitudeDelta: Math.max(0.025, (maxLng - minLng) * 1.8),
  };
};

export const MapScreen: React.FC<MapScreenProps> = () => {
  const theme = useAppTheme();
  const mapRef = useRef<MapView | null>(null);
  const [is3DMode, setIs3DMode] = useState(false);
  const [isFollowMode, setIsFollowMode] = useState(true);
  const [displayedHeading, setDisplayedHeading] = useState(0);
  const [tracksMarkerView, setTracksMarkerView] = useState(true);
  const dashboard = useDashboardStore((state) => state.data);
  const activeVehicleId = useVehiclePreferencesStore((state) => state.activeVehicleId);
  const hydrateVehiclePreferences = useVehiclePreferencesStore((state) => state.hydrate);
  const liveVehicle = dashboard?.vehicles.find((vehicle) => vehicle.id === activeVehicleId) ?? dashboard?.vehicles[0];

  useEffect(() => {
    void hydrateVehiclePreferences();
  }, [hydrateVehiclePreferences]);
  const live = useLiveTracking({
    vehicleId: liveVehicle?.id,
    vehicleName: liveVehicle?.name,
  });
  const coordinates = live.location_points.map((point) => ({
    latitude: point.latitude,
    longitude: point.longitude,
  }));
  const region = useMemo(() => {
    if (coordinates.length > 1) {
      return getRegion(coordinates);
    }
    if (live.hasLiveLocation) {
      return {
        latitude: live.currentPoint.latitude,
        longitude: live.currentPoint.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
    return getRegion(coordinates);
  }, [coordinates, live.currentPoint.latitude, live.currentPoint.longitude, live.hasLiveLocation]);
  const startPoint = coordinates[0];
  const currentPoint = coordinates[coordinates.length - 1];
  const hasAutoFocusedRef = useRef(false);
  const lastFollowUpdateRef = useRef<{latitude: number; longitude: number; heading: number} | null>(null);
  const headingValueRef = useRef(0);
  const headingFrameRef = useRef<number | null>(null);
  const isMoving = live.currentPoint.speed_mps >= HEADING_HOLD_SPEED_MPS || live.currentPoint.is_moving;

  /**
   * Turns the puck to `target` over `durationMs` on a linear ramp. The duration is the same one
   * handed to `animateCamera`, so in 3D the puck and the camera sweep together and the arrow keeps
   * pointing up-screen through a turn instead of swinging out and snapping back.
   */
  const animateHeadingTo = useCallback((target: number, durationMs: number) => {
    if (headingFrameRef.current != null) {
      cancelAnimationFrame(headingFrameRef.current);
      headingFrameRef.current = null;
    }

    const from = headingValueRef.current;
    const delta = shortestHeadingDelta(from, target);
    if (Math.abs(delta) < 0.5) {
      headingValueRef.current = normalizeHeading(target);
      setDisplayedHeading(headingValueRef.current);
      return;
    }

    const startedAt = Date.now();
    const step = () => {
      const progress = Math.min(1, (Date.now() - startedAt) / durationMs);
      headingValueRef.current = normalizeHeading(from + delta * progress);
      setDisplayedHeading(headingValueRef.current);
      headingFrameRef.current = progress < 1 ? requestAnimationFrame(step) : null;
    };

    headingFrameRef.current = requestAnimationFrame(step);
  }, []);

  useEffect(
    () => () => {
      if (headingFrameRef.current != null) {
        cancelAnimationFrame(headingFrameRef.current);
      }
    },
    [],
  );

  /**
   * Rotation now happens natively on the marker, so the rasterized view only has to be refreshed
   * when its content changes (mode switch, moving <-> stopped puck, theme colour).
   */
  useEffect(() => {
    setTracksMarkerView(true);
    const timer = setTimeout(() => setTracksMarkerView(false), 600);
    return () => clearTimeout(timer);
  }, [is3DMode, isMoving, theme.accent]);

  useEffect(() => {
    if (!isMoving) {
      return;
    }
    animateHeadingTo(live.currentPoint.heading_deg, is3DMode ? CAMERA_DURATION_3D : CAMERA_DURATION_2D);
  }, [animateHeadingTo, is3DMode, isMoving, live.currentPoint.heading_deg]);

  const focusCurrentLocation = (next3DMode: boolean, duration = 500, force = false) => {
    if (!mapRef.current || !live.hasLiveLocation) {
      return;
    }

    const previous = lastFollowUpdateRef.current;
    const movedEnough =
      previous == null
        ? true
        : Math.abs(previous.latitude - live.currentPoint.latitude) > 0.00003 ||
          Math.abs(previous.longitude - live.currentPoint.longitude) > 0.00003;
    const headingTurn =
      previous == null
        ? 999
        : Math.abs((((previous.heading - live.currentPoint.heading_deg) % 360) + 540) % 360 - 180);
    const turnedEnough =
      previous == null || headingTurn > 8;

    if (!force && !movedEnough && !turnedEnough) {
      return;
    }

    const currentLocation = {
      latitude: live.currentPoint.latitude,
      longitude: live.currentPoint.longitude,
    };
    // Hold the last known heading while stationary so the camera does not spin on GPS course noise.
    const cameraHeading = isMoving ? normalizeHeading(live.currentPoint.heading_deg) : headingValueRef.current;
    const cameraCenter = next3DMode
      ? getLookAheadCoordinate(currentLocation, cameraHeading, 36)
      : currentLocation;

    mapRef.current.animateCamera(
      {
        center: cameraCenter,
        pitch: next3DMode ? 68 : 0,
        heading: next3DMode ? cameraHeading : 0,
        zoom: next3DMode ? CAMERA_ZOOM_3D : CAMERA_ZOOM_2D,
        altitude: next3DMode ? CAMERA_ALTITUDE_3D : CAMERA_ALTITUDE_2D,
      },
      {duration},
    );

    lastFollowUpdateRef.current = {
      latitude: live.currentPoint.latitude,
      longitude: live.currentPoint.longitude,
      heading: live.currentPoint.heading_deg,
    };
  };

  useEffect(() => {
    if (!mapRef.current || !live.hasLiveLocation) {
      return;
    }

    if (!hasAutoFocusedRef.current) {
      hasAutoFocusedRef.current = true;
      focusCurrentLocation(is3DMode, 500, true);
    }
  }, [is3DMode, live.hasLiveLocation]);

  useEffect(() => {
    if (!isFollowMode || !live.hasLiveLocation) {
      return;
    }

    focusCurrentLocation(is3DMode, is3DMode ? CAMERA_DURATION_3D : CAMERA_DURATION_2D);
  }, [
    is3DMode,
    isFollowMode,
    live.currentPoint.heading_deg,
    live.currentPoint.latitude,
    live.currentPoint.longitude,
    live.hasLiveLocation,
  ]);

  const centerCurrentLocation = () => {
    setIsFollowMode(true);
    focusCurrentLocation(is3DMode, 500, true);
  };

  const toggle3DMode = () => {
    setIs3DMode((previous) => {
      const next = !previous;
      setIsFollowMode(true);
      requestAnimationFrame(() => {
        focusCurrentLocation(next, 850, true);
      });
      return next;
    });
  };

  const toggleFollowMode = () => {
    setIsFollowMode((previous) => {
      const next = !previous;
      if (next) {
        focusCurrentLocation(is3DMode, 500, true);
      }
      return next;
    });
  };

  return (
    <LiveTrackingLayout
      data={live}
      is3DMode={is3DMode}
      isFollowMode={isFollowMode}
      onToggle3DMode={toggle3DMode}
      onToggleFollowMode={toggleFollowMode}
      onCenterCurrentLocation={centerCurrentLocation}
      mapContent={
        <View style={{flex: 1}}>
          <MapView
            ref={mapRef}
            style={{flex: 1}}
            initialRegion={region}
            // Apple Maps (iOS) honours userInterfaceStyle; Google (Android) honours customMapStyle.
            userInterfaceStyle={theme.dark ? 'dark' : 'light'}
            customMapStyle={theme.dark ? DARK_MAP_STYLE : undefined}
            showsUserLocation={false}
            followsUserLocation={false}
            scrollEnabled
            rotateEnabled
            pitchEnabled
            onPanDrag={() => setIsFollowMode(false)}>
            {coordinates.length > 1 ? <Polyline coordinates={coordinates} strokeColor={theme.accent} strokeWidth={4} /> : null}
            {live.hasLiveLocation && currentPoint ? (
              <Circle
                center={currentPoint}
                radius={Math.max(12, live.currentPoint.accuracy_m * 2.2)}
                fillColor="rgba(36,107,255,0.14)"
                strokeColor="rgba(36,107,255,0.28)"
                strokeWidth={1}
              />
            ) : null}
            {startPoint ? <Marker coordinate={startPoint} title="Trip Start" description={live.start_time} pinColor="#4E9B74" /> : null}
            {live.hasLiveLocation && currentPoint ? (
              <Marker
                key={`live-pointer-${is3DMode ? '3d' : '2d'}`}
                coordinate={currentPoint}
                title="Current Fix"
                description={live.currentPoint.recorded_at}
                anchor={{x: 0.5, y: 0.5}}
                centerOffset={{x: 0, y: 0}}
                flat
                rotation={displayedHeading}
                tracksViewChanges={tracksMarkerView}>
                <LiveLocationMarker color={theme.accent} is3D={is3DMode} isMoving={isMoving} />
              </Marker>
            ) : null}
          </MapView>
          {live.permissionState === 'denied' ? (
            <View
              style={{
                // Bottom, not top: the top strip belongs to the status chip and map controls.
                position: 'absolute',
                bottom: 12,
                left: 12,
                right: 12,
                backgroundColor: theme.overlay,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: theme.overlayBorder,
                padding: 12,
                flexDirection: 'row',
                alignItems: 'center',
                shadowColor: '#000000',
                shadowOpacity: 0.15,
                shadowRadius: 8,
                shadowOffset: {width: 0, height: 4},
                elevation: 5,
              }}>
              <Ionicons name="location-outline" size={18} color={theme.danger} />
              <Text style={{flex: 1, color: theme.text, ...theme.typography.caption, fontWeight: '700', marginLeft: 8}}>
                Location access is off. Live tracking needs it to work.
              </Text>
              <TouchableOpacity
                onPress={() => void live.retryLocationPermission()}
                accessibilityRole="button"
                accessibilityLabel="Enable location access"
                style={{
                  backgroundColor: theme.accent,
                  borderRadius: 999,
                  paddingHorizontal: 16,
                  minHeight: 44,
                  justifyContent: 'center',
                  marginLeft: 8,
                }}>
                <Text style={{color: theme.onAccent, ...theme.typography.caption, fontWeight: '800'}}>Enable</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      }
    />
  );
};
