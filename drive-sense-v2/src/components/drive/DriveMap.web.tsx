import {StyleSheet, View} from 'react-native';
import Svg, {Defs, G, Pattern, Polyline, Rect} from 'react-native-svg';
import type {Sample} from '../../stores/recordingStore';
import {useAppTheme} from '../../theme/ThemeProvider';
import {PositionArrow} from './PositionArrow';

interface DriveMapProps {
  position: Sample | null;
  route: {latitude: number; longitude: number}[];
  tilted: boolean;
  headingDeg: number | null;
}

const METERS_PER_DEG = 111320;
const SCALE = 0.4; // px per metre

/** Web stand-in for the native map: city-block pattern, the live route and the position dot. */
export function DriveMap({position, route, tilted, headingDeg}: DriveMapProps) {
  const theme = useAppTheme();
  const c = theme.colors;
  const points =
    position && route.length > 1
      ? route
          .map((p) => {
            const dx = (p.longitude - position.longitude) * METERS_PER_DEG * Math.cos((position.latitude * Math.PI) / 180);
            const dy = (p.latitude - position.latitude) * METERS_PER_DEG;
            return `${200 + dx * SCALE},${300 - dy * SCALE}`;
          })
          .join(' ')
      : '';
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {backgroundColor: c.mapBackdrop},
        // A CSS perspective tilt stands in for the native 3D camera.
        tilted ? {transform: [{perspective: 900}, {rotateX: '35deg'}, {scale: 1.35}]} : null,
      ]}>
      <Svg width="100%" height="100%" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <Pattern id="blocks" width={74} height={62} patternUnits="userSpaceOnUse" patternTransform="rotate(-28)">
            <Rect x={8} y={8} width={58} height={46} rx={7} fill={c.mapBlock} />
          </Pattern>
        </Defs>
        <Rect width={400} height={600} fill="url(#blocks)" />
        {points ? (
          <G>
            <Polyline points={points} fill="none" stroke={c.accent} strokeOpacity={0.25} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
            <Polyline points={points} fill="none" stroke={c.accent} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          </G>
        ) : null}
      </Svg>
      <View style={{position: 'absolute', left: '50%', top: '50%', marginLeft: -36, marginTop: -36, width: 72, height: 72, borderRadius: 36, backgroundColor: c.glassFill, borderWidth: 2, borderColor: c.glassBorder, alignItems: 'center', justifyContent: 'center'}}>
        <PositionArrow rotation={headingDeg} />
      </View>
    </View>
  );
}
