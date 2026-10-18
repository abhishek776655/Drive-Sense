import {View} from 'react-native';
import Svg, {Circle, G, Path, Text as SvgText} from 'react-native-svg';
import {useUnits} from '../../hooks/useUnits';
import type {GaugeStyle} from '../../stores/driveSettingsStore';
import {useAppTheme} from '../../theme/ThemeProvider';
import {RollingNumber} from '../RollingNumber';
import {NeonFace, TapeFace} from './CreativeGauges';
import {NEEDLE_THEMES, ROAD_THEMES} from '../../theme/gaugeThemes';
import {RoadFace, ThemedNeedle} from './ThemedGauges';
import {arcPath, GAUGE_START_DEG, valueToAngle} from '../../utils/gaugeMath';

interface GaugeDialProps {
  /** Speed and dial full scale, both in the chosen unit (km/h or mph). */
  speed: number;
  scale: number;
  gaugeStyle: GaugeStyle;
  accent: string;
  size: number;
}

const END_DEG = GAUGE_START_DEG + 270;

/** Where each style's speed number sits on the 200 grid (baseline y, size, weight). */
type NumberSpot = {baseline: number; fontSize: number; weight: 'bold' | 'black'; color?: string};
const BUILT_IN: Partial<Record<GaugeStyle, NumberSpot>> = {
  arc: {baseline: 116, fontSize: 56, weight: 'black'},
  tape: {baseline: 92, fontSize: 58, weight: 'black'},
  neon: {baseline: 118, fontSize: 60, weight: 'black'},
};
/** Needle dials put the speed under the hub; road scenes, big in the sky. */
const numberSpot = (style: GaugeStyle): NumberSpot => {
  if (style in NEEDLE_THEMES) {
    return {baseline: 150, fontSize: 30, weight: 'black', color: NEEDLE_THEMES[style as keyof typeof NEEDLE_THEMES].number};
  }
  if (style in ROAD_THEMES) {
    return {baseline: 84, fontSize: 50, weight: 'black', color: ROAD_THEMES[style as keyof typeof ROAD_THEMES].line};
  }
  return BUILT_IN[style] ?? {baseline: 116, fontSize: 56, weight: 'black'};
};
/** Line box height as a share of the font size, and where the baseline falls inside it (Nunito). */
const LINE = 1.2;
const BASELINE_FROM_TOP = 0.98;

/** The dial styles on one 200×200 grid (others in `CreativeGauges` and `ThemedGauges`); angle maths lives in `gaugeMath`. */
export function GaugeDial({speed, scale, gaugeStyle, accent, size}: GaugeDialProps) {
  const theme = useAppTheme();
  const c = theme.colors;
  const {speedUnit, units} = useUnits();
  const face = {speed, scale, accent, unit: speedUnit, theme, toKmh: units === 'imperial' ? 1.609344 : 1};
  const angle = valueToAngle(speed, scale);
  const number = numberSpot(gaugeStyle);
  // The 200-unit grid scaled to the dial's size.
  const k = size / 200;

  return (
    <View style={{width: size, height: size}}>
    <Svg width={size} height={size} viewBox="0 0 200 200">
      {gaugeStyle === 'arc' && (
        <G>
          <Circle cx={100} cy={100} r={97} fill={c.card} fillOpacity={0.35} stroke={c.separator} strokeWidth={1.5} />
          <Path d={arcPath(100, 100, 94, GAUGE_START_DEG, END_DEG)} fill="none" stroke={c.textSecondary} strokeOpacity={0.5} strokeWidth={2} strokeDasharray="1.2 9.4" />
          <Path d={arcPath(100, 100, 80, GAUGE_START_DEG, END_DEG)} fill="none" stroke={c.textTertiary} strokeOpacity={0.4} strokeWidth={14} strokeLinecap="round" />
          <Path d={arcPath(100, 100, 80, GAUGE_START_DEG, angle)} fill="none" stroke={accent} strokeOpacity={0.35} strokeWidth={22} strokeLinecap="round" />
          <Path d={arcPath(100, 100, 80, GAUGE_START_DEG, angle)} fill="none" stroke={accent} strokeWidth={14} strokeLinecap="round" />
          <SvgText x={100} y={138} textAnchor="middle" fontSize={13} fontFamily={theme.font.bold} fill={c.textSecondary}>{speedUnit}</SvgText>
        </G>
      )}
      {gaugeStyle === 'tape' && <TapeFace {...face} />}
      {gaugeStyle === 'neon' && <NeonFace {...face} />}
      {gaugeStyle in NEEDLE_THEMES && <ThemedNeedle speed={speed} scale={scale} unit={speedUnit} t={NEEDLE_THEMES[gaugeStyle as keyof typeof NEEDLE_THEMES]} />}
      {gaugeStyle in ROAD_THEMES && <RoadFace speed={speed} scale={scale} t={ROAD_THEMES[gaugeStyle as keyof typeof ROAD_THEMES]} />}
    </Svg>
      {/* The speed sits over the drawing as text so its digits can roll like a timer. */}
      <View pointerEvents="none" style={{position: 'absolute', left: 0, right: 0, top: (number.baseline - number.fontSize * BASELINE_FROM_TOP) * k}}>
        <RollingNumber value={speed} size={number.fontSize * k} lineHeight={number.fontSize * LINE * k} weight={number.weight} color={number.color ?? c.textPrimary} />
      </View>
    </View>
  );
}
