import {StyleSheet, View} from 'react-native';
import Svg, {Circle, Polyline} from 'react-native-svg';
import {useAppTheme} from '../../theme/ThemeProvider';
import type {EventKind} from '../../utils/tripEvents';

type Point = {latitude: number; longitude: number};

/** Web stand-in: the route drawn to fit the card, on the map backdrop colour. */
export function RouteMap({route, events = []}: {route: Point[]; fallback: Point | null; events?: (Point & {id: string; kind: EventKind})[]}) {
  const theme = useAppTheme();
  const c = theme.colors;
  if (route.length < 2) {
    return <View style={[StyleSheet.absoluteFill, {backgroundColor: c.mapBackdrop}]} />;
  }
  const lats = route.map((p) => p.latitude);
  const lons = route.map((p) => p.longitude);
  const [minLat, maxLat, minLon, maxLon] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
  const span = Math.max(maxLat - minLat, maxLon - minLon, 1e-5);
  const toXY = (p: Point) => ({x: 20 + ((p.longitude - minLon) / span) * 260, y: 180 - ((p.latitude - minLat) / span) * 160});
  const pts = route.map(toXY);
  const first = pts[0];
  const last = pts[pts.length - 1];
  return (
    <View style={[StyleSheet.absoluteFill, {backgroundColor: c.mapBackdrop}]}>
      <Svg width="100%" height="100%" viewBox="0 0 300 200" preserveAspectRatio="xMidYMid meet">
        <Polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={c.accent} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        {events.map((event) => {
          const p = toXY(event);
          const fill = event.kind === 'harsh_brake' ? c.red : event.kind === 'overspeed' ? c.purple : c.amber;
          return <Circle key={event.id} cx={p.x} cy={p.y} r={6} fill={fill} stroke={c.onAccent} strokeWidth={2} />;
        })}
        <Circle cx={first.x} cy={first.y} r={5} fill={c.green} stroke={c.onAccent} strokeWidth={2} />
        <Circle cx={last.x} cy={last.y} r={5} fill={c.accent} stroke={c.onAccent} strokeWidth={2} />
      </Svg>
    </View>
  );
}
