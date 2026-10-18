import {Ionicons} from '@expo/vector-icons';
import {useId} from 'react';
import Svg, {Circle, Defs, RadialGradient, Stop, Text as SvgText} from 'react-native-svg';
import {useAppTheme} from '../../theme/ThemeProvider';
import {useReplayEventColor, type ReplayEventKind} from './ReplayEvents';

const FRAME = 48;
const MID = FRAME / 2;

const LOOK_ICON: Record<ReplayEventKind, keyof typeof Ionicons.glyphMap> = {
  rapid_acceleration: 'flash',
  harsh_brake: 'alert',
  overspeed: 'speedometer',
  sharp_turn: 'return-up-forward',
  top_speed: 'rocket',
};

/** A vivid round pin with a white ring and a soft coloured glow, like Rovy's.
 *  One SVG in a fixed frame, no nested views or text layers: Apple Maps then centres the marker
 *  exactly on its coordinate (nested layers drew it off the route line). Kept in its own module so
 *  react-native-maps Markers never pull in Animated / hooks from ReplayEvents.tsx. */
export function ReplayEventMarker({kind, selected}: {kind: ReplayEventKind; selected?: boolean}) {
  const id = `glow${useId().replace(/:/g, '')}`;
  const c = useAppTheme().colors;
  const color = useReplayEventColor()(kind);
  const r = selected ? 18 : 15;
  const iconSize = selected ? 17 : 14;
  const glyph = String.fromCodePoint(Ionicons.glyphMap[LOOK_ICON[kind]] as number);
  return (
    <Svg width={FRAME} height={FRAME}>
      <Defs>
        <RadialGradient id={id} cx={MID} cy={MID} r={MID} gradientUnits="userSpaceOnUse">
          <Stop offset={String(r / MID)} stopColor={color} stopOpacity={0.5} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={MID} cy={MID} r={MID} fill={`url(#${id})`} />
      <Circle cx={MID} cy={MID} r={r - 1.5} fill={color} stroke={c.onAccent} strokeWidth={3} />
      <SvgText x={MID} y={MID + iconSize * 0.36} textAnchor="middle" fontFamily="ionicons" fontSize={iconSize} fill={c.onAccent}>
        {glyph}
      </SvgText>
    </Svg>
  );
}
