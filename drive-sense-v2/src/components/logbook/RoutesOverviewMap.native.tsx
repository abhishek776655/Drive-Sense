import {useMemo} from 'react';
import {Platform, StyleSheet, View} from 'react-native';
import MapView, {Marker, Polyline} from 'react-native-maps';
import {withAlpha} from '../../theme/color';
import {DARK_MAP_STYLE} from '../../theme/mapStyle';
import {useAppTheme} from '../../theme/ThemeProvider';
import {routeRegion} from '../../utils/routeRegion';
import {MapButton} from '../trip/MapButton';
import type {RoutesOverviewMapProps} from './RoutesOverviewMap.types';
import {useMapType} from '../../hooks/useMapType';

/** Every drive in the period on one map; the latest is solid, older ones faded. Tap a line to open that drive. */
export function RoutesOverviewMap({routes, interactive = false, onOpenTrip, onExpand}: RoutesOverviewMapProps) {
  const mapType = useMapType();
  const theme = useAppTheme();
  const c = theme.colors;
  const lines = useMemo(() => routes.map((r) => ({id: r.trip_id, coords: r.points.map(([latitude, longitude]) => ({latitude, longitude}))})), [routes]);
  const region = useMemo(() => routeRegion(lines.flatMap((l) => l.coords)), [lines]);
  if (!region) {
    return null;
  }
  const latest = lines[0];
  return (
    <View style={StyleSheet.absoluteFill}>
      <MapView
        mapType={mapType}
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
        {/* Oldest first, so the latest drive is drawn on top. */}
        {[...lines].reverse().map((line) => (
          <Polyline
            key={line.id}
            coordinates={line.coords}
            strokeColor={line.id === latest.id ? c.accent : withAlpha(c.accent, 0.45)}
            strokeWidth={line.id === latest.id ? 5 : 4}
            lineCap="round"
            lineJoin="round"
            tappable
            onPress={() => onOpenTrip(line.id)}
          />
        ))}
        <Marker coordinate={latest.coords[0]} anchor={{x: 0.5, y: 0.5}} tracksViewChanges={false}>
          <View style={{width: 12, height: 12, borderRadius: 6, backgroundColor: c.green, borderWidth: 2, borderColor: c.onAccent}} />
        </Marker>
      </MapView>
      {onExpand ? (
        <View style={{position: 'absolute', right: 12, bottom: 12}}>
          <MapButton icon="resize" label="Open routes map" onPress={onExpand} />
        </View>
      ) : null}
    </View>
  );
}
