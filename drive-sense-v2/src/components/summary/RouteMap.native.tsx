import {Platform, StyleSheet, View} from 'react-native';
import MapView, {Marker, Polyline} from 'react-native-maps';
import {routeRegion} from '../../utils/routeRegion';
import type {EventKind} from '../../utils/tripEvents';
import {EventMarker} from './EventMarker';
import {DARK_MAP_STYLE} from '../../theme/mapStyle';
import {AppText} from '../AppText';
import {useAppTheme} from '../../theme/ThemeProvider';
import {useMapType} from '../../hooks/useMapType';

type Point = {latitude: number; longitude: number};

/** Static map of the finished route, fitted to its bounds. Not interactive. */
export function RouteMap({route, fallback, events = []}: {route: Point[]; fallback: Point | null; events?: (Point & {id: string; kind: EventKind})[]}) {
  const mapType = useMapType();
  const theme = useAppTheme();
  const start = route[0] ?? fallback;
  const end = route[route.length - 1] ?? fallback;
  // The region is computed from the route's bounds rather than fitted after load: a fit on
  // map-ready raced the layout and framed only the last leg.
  const region = routeRegion(route.length > 0 ? route : start ? [start] : []);

  if (!region) {
    // Nothing recorded and no fix to centre on: a map of the whole country helps no one.
    return (
      <View style={[StyleSheet.absoluteFill, {alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.control}]}>
        <AppText size={14} weight="bold" tone="secondary">
          No route recorded
        </AppText>
      </View>
    );
  }

  return (
    <MapView
      mapType={mapType}
      style={StyleSheet.absoluteFill}
      userInterfaceStyle={theme.scheme}
      customMapStyle={Platform.OS === 'android' && theme.scheme === 'dark' ? DARK_MAP_STYLE : undefined}
      scrollEnabled={false}
      zoomEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
      toolbarEnabled={false}
      showsPointsOfInterests={false}
      initialRegion={region}>
      {route.length > 1 ? (
        <Polyline coordinates={route} strokeColor={theme.colors.accent} strokeWidth={5} lineCap="round" lineJoin="round" />
      ) : null}
      {events.map((event) => (
        <Marker key={event.id} coordinate={event} anchor={{x: 0.5, y: 0.5}} tracksViewChanges={false}>
          <EventMarker kind={event.kind} />
        </Marker>
      ))}
      {start ? (
        <Marker coordinate={start} anchor={{x: 0.5, y: 0.5}} tracksViewChanges={false}>
          <View style={{width: 14, height: 14, borderRadius: 7, backgroundColor: theme.colors.green, borderWidth: 3, borderColor: theme.colors.onAccent}} />
        </Marker>
      ) : null}
      {end && route.length > 1 ? (
        <Marker coordinate={end} anchor={{x: 0.5, y: 0.5}} tracksViewChanges={false}>
          <View style={{width: 14, height: 14, borderRadius: 7, backgroundColor: theme.colors.accent, borderWidth: 3, borderColor: theme.colors.onAccent}} />
        </Marker>
      ) : null}
    </MapView>
  );
}
