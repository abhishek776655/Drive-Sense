import {useEffect, useRef} from 'react';
import {Platform, StyleSheet} from 'react-native';
import MapView, {Circle, Marker, Polyline} from 'react-native-maps';
import type {Sample} from '../../stores/recordingStore';
import {DARK_MAP_STYLE} from '../../theme/mapStyle';
import {useAppTheme} from '../../theme/ThemeProvider';
import {headingDelta, lookAhead} from '../../utils/heading';
import {haversineMeters} from '../../utils/geo';
import {PositionArrow} from './PositionArrow';
import {useMapType} from '../../hooks/useMapType';

interface DriveMapProps {
  position: Sample | null;
  route: {latitude: number; longitude: number}[];
  /** Live drive: tilt the camera into a 3D driving view that faces the direction of travel. */
  tilted: boolean;
  /** Held, smoothed direction of travel; null until the car has moved. */
  headingDeg: number | null;
}

/** Street-level framing. Google (Android) reads `zoom`; Apple Maps (iOS) reads `altitude` in metres. */
const ZOOM = 16.8;
const ALTITUDE_M = 900;
const TILT_DEG = 55;
/** In 3D the camera centres this far ahead of the car, so more road shows in front than behind. */
const LOOK_AHEAD_M = 36;
/** Re-aim the camera only after this much movement or turn, so it does not twitch on GPS noise. */
const RECENTER_M = 3;
const RETURN_DEG = 8;

/**
 * Full-screen map that follows the car: orange live route, position dot with accuracy circle. The
 * user cannot pan it (it always tracks the car); pinch zoom still works. Starting a drive tilts the
 * camera into 3D and Ready flattens it again.
 */
export function DriveMap({position, route, tilted, headingDeg}: DriveMapProps) {
  const mapType = useMapType();
  const theme = useAppTheme();
  const mapRef = useRef<MapView>(null);
  const framed = useRef(false);

  const lastAim = useRef<{latitude: number; longitude: number; heading: number; tilted: boolean} | null>(null);

  // Follow the car. Flat (Ready): north-up, centred on the car. Tilted (live): the camera turns to
  // the direction of travel and looks ahead, as in the old Live tab. The first fix also sets the
  // zoom; later moves keep whatever the user pinched to.
  useEffect(() => {
    if (!position) {
      return;
    }
    const here = {latitude: position.latitude, longitude: position.longitude};
    const facing = tilted && headingDeg != null;
    const heading = facing ? headingDeg : 0;
    const center = facing ? lookAhead(here, heading, LOOK_AHEAD_M) : here;
    const camera = {center, heading, pitch: tilted ? TILT_DEG : 0};
    if (!framed.current) {
      framed.current = true;
      lastAim.current = {...here, heading, tilted};
      mapRef.current?.setCamera({...camera, zoom: ZOOM, altitude: ALTITUDE_M});
      return;
    }
    const last = lastAim.current;
    const moved = last ? haversineMeters(last, here) : Infinity;
    const turned = last ? Math.abs(headingDelta(last.heading, heading)) : Infinity;
    if (last && last.tilted === tilted && moved < RECENTER_M && turned < RETURN_DEG) {
      return;
    }
    lastAim.current = {...here, heading, tilted};
    mapRef.current?.animateCamera(camera, {duration: last && last.tilted !== tilted ? 900 : 600});
  }, [position, tilted, headingDeg]);

  // The arrow is drawn relative to the screen: in the tilted view the map already faces the
  // heading, so the arrow points straight up.
  const arrowRotation = headingDeg == null ? null : tilted ? 0 : headingDeg;

  return (
    <MapView
      mapType={mapType}
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      userInterfaceStyle={theme.scheme}
      customMapStyle={Platform.OS === 'android' && theme.scheme === 'dark' ? DARK_MAP_STYLE : undefined}
      showsCompass={false}
      showsPointsOfInterests={false}
      showsBuildings
      toolbarEnabled={false}
      scrollEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
      initialCamera={
        position
          ? {
              center: {latitude: position.latitude, longitude: position.longitude},
              zoom: ZOOM,
              altitude: ALTITUDE_M,
              pitch: tilted ? TILT_DEG : 0,
              heading: 0,
            }
          : undefined
      }>
      {route.length > 1 ? (
        <>
          <Polyline coordinates={route} strokeColor={theme.colors.accent} strokeWidth={12} lineCap="round" lineJoin="round" />
          <Polyline coordinates={route} strokeColor={theme.colors.accent} strokeWidth={5} lineCap="round" lineJoin="round" />
        </>
      ) : null}
      {position ? (
        <>
          <Circle
            center={position}
            radius={Math.max(8, position.accuracyM ?? 8)}
            fillColor={theme.colors.glassFill}
            strokeColor={theme.colors.glassBorder}
            strokeWidth={2}
          />
          <Marker coordinate={position} anchor={{x: 0.5, y: 0.5}} tracksViewChanges>
            <PositionArrow rotation={arrowRotation} />
          </Marker>
        </>
      ) : null}
    </MapView>
  );
}
