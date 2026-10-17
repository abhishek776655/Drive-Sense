import {StyleSheet, View} from 'react-native';
import Svg, {Polyline} from 'react-native-svg';
import {withAlpha} from '../../theme/color';
import {useAppTheme} from '../../theme/ThemeProvider';
import {MapButton} from '../trip/MapButton';
import type {RoutesOverviewMapProps} from './RoutesOverviewMap.types';

/** Web stand-in: every route drawn to fit the card on the map backdrop colour. */
export function RoutesOverviewMap({routes, onExpand}: RoutesOverviewMapProps) {
  const c = useAppTheme().colors;
  const all = routes.flatMap((r) => r.points);
  if (all.length < 2) {
    return null;
  }
  const lats = all.map(([lat]) => lat);
  const lons = all.map(([, lon]) => lon);
  const [minLat, maxLat, minLon, maxLon] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
  const span = Math.max(maxLat - minLat, maxLon - minLon, 1e-5);
  const xy = ([lat, lon]: [number, number]) => `${20 + ((lon - minLon) / span) * 260},${180 - ((lat - minLat) / span) * 160}`;
  return (
    <View style={[StyleSheet.absoluteFill, {backgroundColor: c.mapBackdrop}]}>
      <Svg width="100%" height="100%" viewBox="0 0 300 200" preserveAspectRatio="xMidYMid meet">
        {[...routes].reverse().map((r, i, arr) => (
          <Polyline
            key={r.trip_id}
            points={r.points.map(xy).join(' ')}
            fill="none"
            stroke={i === arr.length - 1 ? c.accent : withAlpha(c.accent, 0.45)}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </Svg>
      {onExpand ? (
        <View style={{position: 'absolute', right: 12, bottom: 12}}>
          <MapButton icon="resize" label="Open routes map" onPress={onExpand} />
        </View>
      ) : null}
    </View>
  );
}
