import {useMemo} from 'react';
import {Platform, StyleSheet, View} from 'react-native';
import MapView, {Marker, Polyline} from 'react-native-maps';
import {DARK_MAP_STYLE} from '../../theme/mapStyle';
import {useAppTheme} from '../../theme/ThemeProvider';
import {routeRegion} from '../../utils/routeRegion';
import {MAP_POINTS, speedSegments, thin} from '../../utils/tripAnalysis';
import {AppText} from '../AppText';
import {EventMarker} from '../summary/EventMarker';
import {MapButton} from './MapButton';
import {FinishFlag, StartFlag} from './RouteMarkers';
import {SpeedLegend} from './SpeedLegend';
import type {TripRouteMapProps} from './TripRouteMap.types';
import {useMapType} from '../../hooks/useMapType';

/** Zoom used when a stop is focused (~350 m across). */
const FOCUS_DELTA = 0.0035;

/** The trip's route coloured by speed, with start/end flags and event markers. */
export function TripRouteMap({points, events, mode = 'speed', interactive = false, focus = null, legendStyle = {left: 12, top: 12}, showEvents = true, onExpand}: TripRouteMapProps) {
  const mapType = useMapType();
  const theme = useAppTheme();
  const c = theme.colors;
  const route = useMemo(() => thin(points, MAP_POINTS).map((p) => ({latitude: p.latitude, longitude: p.longitude})), [points]);
  const lines = useMemo(() => (mode === 'speed' ? speedSegments(points, c) : []), [points, mode, c]);
  const region = focus ? {...focus, latitudeDelta: FOCUS_DELTA, longitudeDelta: FOCUS_DELTA} : routeRegion(route);

  if (!region) {
    return (
      <View style={[StyleSheet.absoluteFill, {alignItems: 'center', justifyContent: 'center', backgroundColor: c.control}]}>
        <AppText size={14} weight="bold" tone="secondary">
          No route recorded
        </AppText>
      </View>
    );
  }

  const start = route[0];
  const end = route[route.length - 1];
  return (
    <View style={StyleSheet.absoluteFill}>
      <MapView
        mapType={mapType}
        // A new focus re-mounts the map so it opens centred there.
        key={focus ? `${focus.latitude},${focus.longitude}` : 'route'}
        style={StyleSheet.absoluteFill}
        userInterfaceStyle={theme.scheme}
        customMapStyle={Platform.OS === 'android' && theme.scheme === 'dark' ? DARK_MAP_STYLE : undefined}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsPointsOfInterests={false}
        initialRegion={region}>
        {route.length > 1 ? (
          // Speed mode: a wide pale casing under the coloured lines keeps them readable on any map.
          <Polyline coordinates={route} strokeColor={mode === 'speed' ? c.card : c.accent} strokeWidth={mode === 'speed' ? 9 : 5} lineCap="round" lineJoin="round" />
        ) : null}
        {lines.map((line) => (
          <Polyline key={line.key} coordinates={line.coords} strokeColor={line.color} strokeWidth={5} lineCap="round" lineJoin="round" zIndex={2} />
        ))}
        {(showEvents ? events : []).map((event) => (
          <Marker
            key={event.id}
            coordinate={event}
            title={event.title}
            description={event.description}
            anchor={{x: 0.5, y: 0.5}}
            tracksViewChanges={false}
            zIndex={3}>
            <EventMarker kind={event.kind} />
          </Marker>
        ))}
        {start ? (
          <Marker coordinate={start} anchor={{x: 0.5, y: 0.5}} tracksViewChanges={false} zIndex={4}>
            <StartFlag />
          </Marker>
        ) : null}
        {end && route.length > 1 ? (
          <Marker coordinate={end} anchor={{x: 0.5, y: 0.5}} tracksViewChanges={false} zIndex={4}>
            <FinishFlag />
          </Marker>
        ) : null}
      </MapView>
      {mode === 'speed' && route.length > 1 ? (
        <View pointerEvents="none" style={{position: 'absolute', ...legendStyle}}>
          <SpeedLegend />
        </View>
      ) : null}
      {onExpand ? (
        <View style={{position: 'absolute', right: 12, top: 12}}>
          <MapButton icon="expand" label="Open full-screen map" onPress={onExpand} />
        </View>
      ) : null}
    </View>
  );
}
