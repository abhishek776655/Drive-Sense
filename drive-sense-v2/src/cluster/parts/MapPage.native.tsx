import {LinearGradient} from 'expo-linear-gradient';
import {useEffect, useRef} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import MapView, {Polyline, type UserLocationChangeEvent} from 'react-native-maps';
import {useRecordingStore} from '../../stores/recordingStore';
import {withAlpha} from '../../theme/color';
import {FONT} from '../../theme/theme';
import {CLUSTER_INK} from '../accents';

/** Camera moves no more often than this; each move eases over most of it. */
const FOLLOW_MS = 800;
/** Apple Maps frames by altitude (metres above the car), Google by zoom; both are given. */
const ALTITUDE_M = 450;
const ZOOM = 16.5;

const clear = withAlpha(CLUSTER_INK.background, 0);
const solid = CLUSTER_INK.background;

/**
 * The Map page: a dimmed dark map that follows the car (heading up, tilted), the drive's route in
 * the accent colour, its edges dissolving into the cluster's black instead of ending at a frame.
 */
export function MapPage({accent}: {accent: string}) {
  const position = useRecordingStore((s) => s.position);
  const route = useRecordingStore((s) => s.route);
  const map = useRef<MapView>(null);
  const lastMove = useRef(0);
  const heading = useRef(0);

  const follow = (latitude: number, longitude: number, headingDeg: number | null | undefined) => {
    const now = Date.now();
    if (now - lastMove.current < FOLLOW_MS) {
      return;
    }
    lastMove.current = now;
    // Standing still reports no heading (-1); keep pointing the way the car last went.
    if (headingDeg != null && headingDeg >= 0) {
      heading.current = headingDeg;
    }
    map.current?.animateCamera({center: {latitude, longitude}, heading: heading.current, pitch: 50, altitude: ALTITUDE_M, zoom: ZOOM}, {duration: FOLLOW_MS - 50});
  };

  // The drive's own fixes (also what the background task delivers)…
  useEffect(() => {
    if (position) {
      follow(position.latitude, position.longitude, position.headingDeg);
    }
  }, [position]);
  // …and the map's own location, which keeps coming when the drive's feed is quiet.
  const onUserLocation = (e: UserLocationChangeEvent) => {
    const c = e.nativeEvent.coordinate;
    if (c) {
      follow(c.latitude, c.longitude, c.heading);
    }
  };

  if (!position) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Waiting for location</Text>
      </View>
    );
  }
  return (
    <View style={styles.frame}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        mapType="mutedStandard"
        userInterfaceStyle="dark"
        showsUserLocation
        onUserLocationChange={onUserLocation}
        showsCompass={false}
        showsPointsOfInterests={false}
        showsBuildings={false}
        pitchEnabled={false}
        rotateEnabled={false}
        scrollEnabled={false}
        zoomEnabled={false}
        initialCamera={{center: {latitude: position.latitude, longitude: position.longitude}, heading: 0, pitch: 50, zoom: ZOOM, altitude: ALTITUDE_M}}>
        {route.length > 1 ? <Polyline coordinates={route} strokeColor={accent} strokeWidth={5} lineCap="round" lineJoin="round" /> : null}
      </MapView>
      {/* Dimmed towards black, so the map sits back behind the dials' light. */}
      <View pointerEvents="none" style={styles.dim} />
      {/* Long, eased fades on every side: the map dissolves into the background. */}
      <LinearGradient pointerEvents="none" colors={[solid, withAlpha(solid, 0.45), clear]} locations={[0, 0.3, 1]} style={[styles.edge, styles.top]} />
      <LinearGradient pointerEvents="none" colors={[clear, withAlpha(solid, 0.45), solid]} locations={[0, 0.7, 1]} style={[styles.edge, styles.bottom]} />
      <LinearGradient pointerEvents="none" colors={[solid, withAlpha(solid, 0.45), clear]} locations={[0, 0.3, 1]} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={[styles.side, styles.left]} />
      <LinearGradient pointerEvents="none" colors={[clear, withAlpha(solid, 0.45), solid]} locations={[0, 0.7, 1]} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={[styles.side, styles.right]} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {flex: 1, overflow: 'hidden'},
  dim: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: withAlpha(CLUSTER_INK.background, 0.45)},
  edge: {position: 'absolute', left: 0, right: 0, height: '22%'},
  top: {top: 0},
  bottom: {bottom: 0},
  side: {position: 'absolute', top: 0, bottom: 0, width: '16%'},
  left: {left: 0},
  right: {right: 0},
  empty: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  emptyText: {color: CLUSTER_INK.textDim, fontFamily: FONT.bold, fontSize: 14},
});
