import {Ionicons} from '@expo/vector-icons';
import {useState} from 'react';
import {View} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {useAppTheme} from '../theme/ThemeProvider';
import {AppText} from './AppText';

const PADDING = 16;
/** Height of the icon / label row. */
const HEADER = 22;
/** The arc spans 260°, open at the bottom like a speedometer. */
const SWEEP_DEG = 260;
const STROKE = 8;

/** A symmetric gauge arc around (cx, cy), open at the bottom. */
function gaugePath(cx: number, cy: number, r: number) {
  const half = (SWEEP_DEG / 2) * (Math.PI / 180);
  // Angles measured from straight up, clockwise.
  const point = (a: number) => `${(cx + r * Math.sin(a)).toFixed(2)} ${(cy - r * Math.cos(a)).toFixed(2)}`;
  return `M${point(-half)}A${r} ${r} 0 1 1 ${point(half)}`;
}

/**
 * Orange Top Speed hero. The faint arc behind the value is decoration (as in Rovy), not data: a
 * speedometer outline centred on the value. The value is large Black-weight type, which is where
 * white on the base orange is acceptable.
 */
export function HeroTile({label, value, unit}: {label: string; value: string; unit: string}) {
  const theme = useAppTheme();
  const [size, setSize] = useState({width: 0, height: 0});
  // Fit the gauge between the header and the bottom edge: its top clears the header and its open
  // ends stop short of the bottom, then it is as wide as the tile allows.
  const top = PADDING + HEADER + STROKE;
  const bottom = size.height - PADDING / 2;
  const below = -Math.cos((SWEEP_DEG / 2) * (Math.PI / 180)); // how far the ends sit under the centre, per unit radius
  const r = Math.min(size.width / 2 - PADDING, (bottom - top) / (1 + below));
  const cx = size.width / 2;
  const cy = top + r;

  return (
    <View
      onLayout={(e) => setSize({width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height})}
      style={{
        flex: 1,
        backgroundColor: theme.colors.accent,
        borderRadius: theme.radius.hero,
        padding: PADDING,
        overflow: 'hidden',
        shadowColor: theme.colors.accent,
        shadowOpacity: theme.scheme === 'light' ? 0.35 : 0.25,
        shadowRadius: 16,
        shadowOffset: {width: 0, height: 8},
      }}>
      {r > 0 ? (
        <Svg pointerEvents="none" width={size.width} height={size.height} style={{position: 'absolute', left: 0, top: 0}}>
          <Path
            d={gaugePath(cx, cy, r)}
            fill="none"
            stroke={theme.colors.onAccent}
            strokeOpacity={0.16}
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
        </Svg>
      ) : null}
      <View style={{height: HEADER, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
        <Ionicons name="flame" size={22} color={theme.colors.onAccent} />
        <AppText size={12} weight="extrabold" tone="onAccent" style={{opacity: 0.6, letterSpacing: 0.8}}>
          {label.toUpperCase()}
        </AppText>
      </View>
      <View
        pointerEvents="none"
        style={{position: 'absolute', left: 0, right: 0, top: cy - 34, alignItems: 'center', opacity: size.width ? 1 : 0}}>
        <AppText size={44} weight="black" tone="onAccent" style={{lineHeight: 50}} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </AppText>
        <AppText size={14} weight="bold" tone="onAccent" style={{opacity: 0.85, marginTop: -2}}>
          {unit}
        </AppText>
      </View>
    </View>
  );
}
