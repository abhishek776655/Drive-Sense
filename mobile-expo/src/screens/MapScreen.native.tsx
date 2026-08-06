import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import MapView, {Circle, Marker, Polyline} from 'react-native-maps';
import {MapScreenProps} from '../navigation/types';
import {LiveTrackingLayout} from '../components/LiveTrackingLayout';
import {LiveLocationMarker} from '../components/LiveLocationMarker';
import {useAppTheme} from '../theme/appTheme';
import {useLiveTracking} from '../hooks/useLiveTracking';
import {useDashboardStore} from '../store/dashboardStore';
import {useVehiclePreferencesStore} from '../store/vehiclePreferencesStore';

const normalizeHeading = (value: number) => {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

const CAMERA_ZOOM_2D = 16.4;
const CAMERA_ZOOM_3D = 19.2;
const CAMERA_ALTITUDE_2D = 760;
const CAMERA_ALTITUDE_3D = 240;

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
  useEffect(() => {
    let frame = 0;
    const targetHeading = normalizeHeading(live.currentPoint.heading_deg);

    const animateHeading = () => {
      setDisplayedHeading((current) => {
        const delta = ((((targetHeading - current) % 360) + 540) % 360) - 180;
        if (Math.abs(delta) < 1) {
          return targetHeading;
        }
        frame = requestAnimationFrame(animateHeading);
        return normalizeHeading(current + delta * 0.2);
      });
    };

    frame = requestAnimationFrame(animateHeading);
    return () => cancelAnimationFrame(frame);
  }, [live.currentPoint.heading_deg]);

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
    const cameraCenter = next3DMode
      ? getLookAheadCoordinate(currentLocation, live.currentPoint.heading_deg, 36)
      : currentLocation;

    mapRef.current.animateCamera(
      {
        center: cameraCenter,
        pitch: next3DMode ? 68 : 0,
        heading: next3DMode ? normalizeHeading(live.currentPoint.heading_deg) : 0,
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

    focusCurrentLocation(is3DMode, is3DMode ? 900 : 650);
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
            {startPoint ? <Marker coordinate={startPoint} title="Trip Start" description={live.start_time} pinColor="#22C55E" /> : null}
            {live.hasLiveLocation && currentPoint ? (
              <Marker
                key={`live-pointer-${is3DMode ? '3d' : '2d'}`}
                coordinate={currentPoint}
                title="Current Fix"
                description={live.currentPoint.recorded_at}
                anchor={{x: 0.5, y: 0.5}}
                flat={is3DMode}
                rotation={is3DMode ? displayedHeading : 0}
                tracksViewChanges={!is3DMode}>
                <LiveLocationMarker
                  color={theme.accent}
                  is3D={is3DMode}
                  headingDeg={displayedHeading}
                />
              </Marker>
            ) : null}
          </MapView>
          {live.permissionState === 'denied' ? (
            <View
              style={{
                position: 'absolute',
                top: 12,
                left: 12,
                right: 12,
                backgroundColor: theme.card,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: theme.cardBorder,
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
                style={{
                  backgroundColor: theme.accent,
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
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
