import {Ionicons, MaterialCommunityIcons} from '@expo/vector-icons';
import {View} from 'react-native';
import Svg, {Circle, Defs, G, Path, RadialGradient, Stop} from 'react-native-svg';
import {useAppTheme} from '../../theme/ThemeProvider';

/** Start: green disc with a flag. */
export function StartFlag() {
  const theme = useAppTheme();
  return (
    <View style={{width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.green, borderWidth: 3, borderColor: theme.colors.onAccent, alignItems: 'center', justifyContent: 'center'}}>
      <Ionicons name="flag-outline" size={13} color={theme.colors.onAccent} />
    </View>
  );
}

/** Destination: red disc with a white checkered flag, as in Rovy. */
export function FinishFlag() {
  const theme = useAppTheme();
  return (
    <View style={{width: 30, height: 30, borderRadius: 15, backgroundColor: theme.colors.red, borderWidth: 3, borderColor: theme.colors.onAccent, alignItems: 'center', justifyContent: 'center'}}>
      <MaterialCommunityIcons name="flag-checkered" size={15} color={theme.colors.onAccent} />
    </View>
  );
}

/** The car during a replay: accent disc with an arrow pointing the way it is heading. */
/**
 * One frame for both looks: the map keeps a marker's first size, so the arrow and the dot share it
 * and never sit off the route line when the view switches. Big enough for the heading beam.
 */
const CAR_FRAME = 84;
const DOT = 22;
/** The beam: a wedge this wide, fading out from the dot, like Google Maps' heading cone. */
const BEAM_HALF_ANGLE = 32;
const BEAM_RADIUS = CAR_FRAME / 2;

/** A wedge from the centre, pointing up (north before rotation). */
const beamPath = () => {
  const c = CAR_FRAME / 2;
  const a = (BEAM_HALF_ANGLE * Math.PI) / 180;
  const x1 = c - BEAM_RADIUS * Math.sin(a);
  const x2 = c + BEAM_RADIUS * Math.sin(a);
  const y = c - BEAM_RADIUS * Math.cos(a);
  return `M ${c} ${c} L ${x1} ${y} A ${BEAM_RADIUS} ${BEAM_RADIUS} 0 0 1 ${x2} ${y} Z`;
};

/**
 * The car on a replay: an arrow pointing the way it drives (Follow), or (`dot`) a round marker with
 * a soft beam in the direction of travel (the normal view).
 */
export function CarMarker({heading, dot = false}: {heading: number | null; dot?: boolean}) {
  const theme = useAppTheme();
  const c = theme.colors;
  return (
    <View style={{width: CAR_FRAME, height: CAR_FRAME, alignItems: 'center', justifyContent: 'center'}}>
      {dot ? (
        // One SVG, no absolutely placed layers: Apple Maps then centres the marker on the route.
        <Svg width={CAR_FRAME} height={CAR_FRAME}>
          <Defs>
            <RadialGradient id="beam" cx={CAR_FRAME / 2} cy={CAR_FRAME / 2} r={BEAM_RADIUS} gradientUnits="userSpaceOnUse">
              <Stop offset="0.2" stopColor={c.accent} stopOpacity={0.55} />
              <Stop offset="1" stopColor={c.accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          {heading != null ? (
            <G rotation={heading} origin={`${CAR_FRAME / 2}, ${CAR_FRAME / 2}`}>
              <Path d={beamPath()} fill="url(#beam)" />
            </G>
          ) : null}
          <Circle cx={CAR_FRAME / 2} cy={CAR_FRAME / 2} r={DOT / 2 - 2} fill={c.accent} stroke={c.onAccent} strokeWidth={4} />
        </Svg>
      ) : (
        <View style={{width: 36, height: 36, borderRadius: 18, backgroundColor: c.accent, borderWidth: 3, borderColor: c.onAccent, alignItems: 'center', justifyContent: 'center'}}>
          <MaterialCommunityIcons name="navigation" size={18} color={c.onAccent} style={{transform: [{rotate: `${heading ?? 0}deg`}]}} />
        </View>
      )}
    </View>
  );
}
