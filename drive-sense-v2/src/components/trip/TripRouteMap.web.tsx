import {StyleSheet, View} from 'react-native';
import Svg, {Circle, Line} from 'react-native-svg';
import {useAppTheme} from '../../theme/ThemeProvider';
import {speedColor} from '../../utils/speedColor';
import {MAP_POINTS, segments, thin} from '../../utils/tripAnalysis';
import {AppText} from '../AppText';
import {MapButton} from './MapButton';
import {SpeedLegend} from './SpeedLegend';
import type {LatLng, TripRouteMapProps} from './TripRouteMap.types';

/** Web stand-in: the route drawn to fit the card, coloured by speed, on the map backdrop colour. */
export function TripRouteMap({points, events = [], showEvents = true, mode = 'speed', legendStyle = {left: 12, top: 12}, onExpand}: TripRouteMapProps) {
  const c = useAppTheme().colors;
  const segs = segments(thin(points, MAP_POINTS));
  if (segs.length === 0) {
    return (
      <View style={[StyleSheet.absoluteFill, {alignItems: 'center', justifyContent: 'center', backgroundColor: c.mapBackdrop}]}>
        <AppText size={14} weight="bold" tone="secondary">
          No route recorded
        </AppText>
      </View>
    );
  }
  const lats = points.map((p) => p.latitude);
  const lons = points.map((p) => p.longitude);
  const [minLat, maxLat, minLon, maxLon] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
  const span = Math.max(maxLat - minLat, maxLon - minLon, 1e-5);
  const toXY = (p: LatLng) => ({x: 20 + ((p.longitude - minLon) / span) * 260, y: 180 - ((p.latitude - minLat) / span) * 160});
  const first = toXY(segs[0].from);
  const last = toXY(segs[segs.length - 1].to);
  const eventColor = (kind: string) =>
    ({rapid_acceleration: c.green, harsh_brake: c.red, overspeed: c.blue, sharp_turn: c.purple, top_speed: c.accent}[kind] ?? c.accent);
  return (
    <View style={[StyleSheet.absoluteFill, {backgroundColor: c.mapBackdrop}]}>
      <Svg width="100%" height="100%" viewBox="0 0 300 200" preserveAspectRatio="xMidYMid meet">
        {segs.map((s, i) => {
          const a = toXY(s.from);
          const b = toXY(s.to);
          return <Line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={mode === 'speed' ? speedColor(s.kmh, c) : c.accent} strokeWidth={4} strokeLinecap="round" />;
        })}
        {(showEvents ? events : []).map((e) => {
          const pt = toXY(e);
          return <Circle key={e.id} cx={pt.x} cy={pt.y} r={6} fill={eventColor(e.kind)} stroke={c.onAccent} strokeWidth={2} />;
        })}
        <Circle cx={first.x} cy={first.y} r={5} fill={c.green} stroke={c.onAccent} strokeWidth={2} />
        <Circle cx={last.x} cy={last.y} r={5} fill={c.red} stroke={c.onAccent} strokeWidth={2} />
      </Svg>
      {mode === 'speed' ? (
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
