import {useEffect, useRef} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import MapView, {Polyline} from 'react-native-maps';
import {useRecordingStore} from '../../stores/recordingStore';
import {FONT} from '../../theme/theme';
import {CLUSTER_INK} from '../accents';

/** The Map page: a dark map following the car, the drive's route in the accent colour. */
export function MapPage({accent}: {accent: string}) {
  const position = useRecordingStore((s) => s.position);
  const route = useRecordingStore((s) => s.route);
  const map = useRef<MapView>(null);

  useEffect(() => {
    if (position) {
      map.current?.animateCamera(
        {center: {latitude: position.latitude, longitude: position.longitude}, heading: position.headingDeg ?? 0, pitch: 45, zoom: 16},
        {duration: 900},
      );
    }
  }, [position]);

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
        userInterfaceStyle="dark"
        showsUserLocation
        showsCompass={false}
        showsPointsOfInterests={false}
        pitchEnabled={false}
        rotateEnabled={false}
        scrollEnabled={false}
        zoomEnabled={false}
        initialCamera={{center: {latitude: position.latitude, longitude: position.longitude}, heading: 0, pitch: 45, zoom: 16, altitude: 600}}>
        {route.length > 1 ? <Polyline coordinates={route} strokeColor={accent} strokeWidth={5} lineCap="round" lineJoin="round" /> : null}
      </MapView>
      {/* Fades the map's edges into the panel, so it sits inside the glass rather than on top. */}
      <View pointerEvents="none" style={styles.vignette} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {flex: 1, borderRadius: 18, overflow: 'hidden'},
  vignette: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 18, borderWidth: 10, borderColor: 'rgba(3,4,6,0.55)'},
  empty: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  emptyText: {color: CLUSTER_INK.textDim, fontFamily: FONT.bold, fontSize: 14},
});
