import {View} from 'react-native';
import Svg, {Circle, G, Line, Path, Rect, Text as SvgText} from 'react-native-svg';
import {useUnits} from '../../hooks/useUnits';
import type {GaugeStyle} from '../../stores/driveSettingsStore';
import {useAppTheme} from '../../theme/ThemeProvider';
import {RollingNumber} from '../RollingNumber';
import {HeritageFace, NeonFace, RetroFace, RingFace, TapeFace} from './CreativeGauges';
import {arcPath, clampFraction, GAUGE_START_DEG, polar, valueToAngle} from '../../utils/gaugeMath';

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
const NUMBER: Record<GaugeStyle, {baseline: number; fontSize: number; weight: 'bold' | 'black'}> = {
  arc: {baseline: 116, fontSize: 56, weight: 'black'},
  classic: {baseline: 152, fontSize: 30, weight: 'black'},
  digital: {baseline: 116, fontSize: 68, weight: 'black'},
  minimal: {baseline: 118, fontSize: 62, weight: 'bold'},
  ring: {baseline: 118, fontSize: 60, weight: 'black'},
  retro: {baseline: 118, fontSize: 56, weight: 'black'},
  tape: {baseline: 92, fontSize: 58, weight: 'black'},
  heritage: {baseline: 148, fontSize: 22, weight: 'black'},
  neon: {baseline: 118, fontSize: 60, weight: 'black'},
};
/** Line box height as a share of the font size, and where the baseline falls inside it (Nunito). */
const LINE = 1.2;
const BASELINE_FROM_TOP = 0.98;

/** Nine dial styles on one 200×200 grid (the newer five in `CreativeGauges`); angle maths lives in `gaugeMath`. */
export function GaugeDial({speed, scale, gaugeStyle, accent, size}: GaugeDialProps) {
  const theme = useAppTheme();
  const c = theme.colors;
  const {speedUnit, units} = useUnits();
  const face = {speed, scale, accent, unit: speedUnit, theme, toKmh: units === 'imperial' ? 1.609344 : 1};
  const angle = valueToAngle(speed, scale);
  const number = NUMBER[gaugeStyle];
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
      {gaugeStyle === 'classic' && (
        <G>
          <Circle cx={100} cy={100} r={97} fill={c.card} stroke={c.separator} strokeWidth={3} />
          <Path d={arcPath(100, 100, 84, GAUGE_START_DEG, END_DEG)} fill="none" stroke={c.textSecondary} strokeWidth={7} strokeDasharray="1.4 10.4" />
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const p = polar(100, 100, 66, GAUGE_START_DEG + 270 * f);
            return (
              <SvgText key={f} x={p.x} y={p.y + 4} textAnchor="middle" fontSize={11} fontFamily={theme.font.extrabold} fill={c.textSecondary}>
                {Math.round(scale * f)}
              </SvgText>
            );
          })}
          {(() => {
            const tip = polar(100, 100, 72, angle);
            return <Line x1={100} y1={100} x2={tip.x} y2={tip.y} stroke={accent} strokeWidth={4.5} strokeLinecap="round" />;
          })()}
          <Circle cx={100} cy={100} r={8} fill={c.control} stroke={accent} strokeWidth={2} />
          <SvgText x={100} y={168} textAnchor="middle" fontSize={10} fontFamily={theme.font.bold} fill={c.textSecondary}>{speedUnit}</SvgText>
        </G>
      )}
      {gaugeStyle === 'digital' && (
        <G>
          <Rect x={6} y={46} width={188} height={108} rx={22} fill={c.card} fillOpacity={0.5} stroke={c.separator} strokeWidth={1.5} />
          <SvgText x={100} y={134} textAnchor="middle" fontSize={12} fontFamily={theme.font.bold} fill={c.textSecondary}>{speedUnit}</SvgText>
          <Path d="M22 144H178" stroke={c.textTertiary} strokeOpacity={0.5} strokeWidth={8} strokeDasharray="6 2.4" />
          {clampFraction(speed, scale) > 0 && (
            <Path d={`M22 144H${22 + 156 * clampFraction(speed, scale)}`} stroke={accent} strokeWidth={8} strokeDasharray="6 2.4" />
          )}
        </G>
      )}
      {gaugeStyle === 'minimal' && (
        <G>
          <Path d={arcPath(100, 100, 84, GAUGE_START_DEG, END_DEG)} fill="none" stroke={c.textTertiary} strokeOpacity={0.5} strokeWidth={3} strokeLinecap="round" />
          <Path d={arcPath(100, 100, 84, GAUGE_START_DEG, angle)} fill="none" stroke={accent} strokeWidth={3} strokeLinecap="round" />
          {(() => {
            const p = polar(100, 100, 84, angle);
            return <Circle cx={p.x} cy={p.y} r={5.5} fill={accent} />;
          })()}
          <SvgText x={100} y={142} textAnchor="middle" fontSize={13} fontFamily={theme.font.semibold} fill={c.textSecondary}>{speedUnit}</SvgText>
        </G>
      )}
      {gaugeStyle === 'ring' && <RingFace {...face} />}
      {gaugeStyle === 'retro' && <RetroFace {...face} />}
      {gaugeStyle === 'tape' && <TapeFace {...face} />}
      {gaugeStyle === 'heritage' && <HeritageFace {...face} />}
      {gaugeStyle === 'neon' && <NeonFace {...face} />}
    </Svg>
      {/* The speed sits over the drawing as text so its digits can roll like a timer. */}
      <View pointerEvents="none" style={{position: 'absolute', left: 0, right: 0, top: (number.baseline - number.fontSize * BASELINE_FROM_TOP) * k}}>
        <RollingNumber value={speed} size={number.fontSize * k} lineHeight={number.fontSize * LINE * k} weight={number.weight} color={c.textPrimary} />
      </View>
    </View>
  );
}
