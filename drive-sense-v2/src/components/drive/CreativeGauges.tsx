import {useId} from 'react';
import {Circle, ClipPath, Defs, G, Line, Path, Rect, Text as SvgText} from 'react-native-svg';
import type {AppTheme} from '../../theme/theme';
import {arcPath, clampFraction, GAUGE_START_DEG, polar, valueToAngle} from '../../utils/gaugeMath';

/**
 * Two dial faces drawn on the same 200 × 200 grid as `GaugeDial`'s originals: HUD (aviation
 * speed tape) and Neon (glowing arc). The speed number is laid over them
 * by `GaugeDial`, except where a face draws its own.
 */
export interface FaceProps {
  /** Speed and full scale in the chosen unit. */
  speed: number;
  scale: number;
  /** Multiply a value in the chosen unit by this to get km/h (for the speed colours). */
  toKmh: number;
  accent: string;
  unit: string;
  theme: AppTheme;
}

const END_DEG = GAUGE_START_DEG + 270;

/** A round step for labels: about `count` labels across the scale, at 10, 20, 25, 50 … */
export const niceStep = (scale: number, count = 6): number => {
  const raw = scale / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / pow;
  const nice = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10;
  return nice * pow;
};




const TAPE_PX = 2.2;

/** Aviation speed tape: the scale slides under a fixed pointer; the number sits above it. */
export function TapeFace({speed, unit, accent, theme}: FaceProps) {
  const c = theme.colors;
  const clip = `tape-${useId().replace(/:/g, '')}`;
  const half = 90 / TAPE_PX;
  const first = Math.max(0, Math.ceil((speed - half) / 5) * 5);
  const ticks: number[] = [];
  for (let v = first; v <= speed + half; v += 5) {
    ticks.push(v);
  }
  return (
    <G>
      <SvgText x={100} y={34} textAnchor="middle" fontSize={12} fontFamily={theme.font.extrabold} fill={c.textSecondary} letterSpacing={1}>
        {unit.toUpperCase()}
      </SvgText>
      <Defs>
        <ClipPath id={clip}>
          <Rect x={10} y={114} width={180} height={52} rx={14} />
        </ClipPath>
      </Defs>
      <Rect x={10} y={114} width={180} height={52} rx={14} fill={c.card} fillOpacity={0.6} stroke={c.separator} strokeWidth={1.5} />
      <G clipPath={`url(#${clip})`}>
        {ticks.map((v) => {
          const x = 100 + (v - speed) * TAPE_PX;
          const major = v % 20 === 0;
          return (
            <G key={v}>
              <Line x1={x} y1={114} x2={x} y2={major ? 134 : 124} stroke={c.textSecondary} strokeOpacity={major ? 0.9 : 0.45} strokeWidth={major ? 2.2 : 1.4} />
              {major ? (
                <SvgText x={x} y={156} textAnchor="middle" fontSize={12} fontFamily={theme.font.extrabold} fill={c.textSecondary}>
                  {v}
                </SvgText>
              ) : null}
            </G>
          );
        })}
      </G>
      <Path d="M92 104 L108 104 L100 114 Z" fill={accent} />
      <Line x1={100} y1={114} x2={100} y2={140} stroke={accent} strokeWidth={2.6} />
    </G>
  );
}


/** Synthwave neon: the accent arc glows through stacked soft strokes, brightest at its tip. */
export function NeonFace({speed, scale, accent, unit, theme}: FaceProps) {
  const c = theme.colors;
  const angle = valueToAngle(speed, scale);
  const glow = [
    {width: 30, opacity: 0.07},
    {width: 22, opacity: 0.12},
    {width: 14, opacity: 0.25},
    {width: 6, opacity: 1},
  ];
  const tip = polar(100, 100, 82, angle);
  return (
    <G>
      {Array.from({length: 11}, (_, i) => {
        const p = polar(100, 100, 97, GAUGE_START_DEG + 27 * i);
        return <Circle key={i} cx={p.x} cy={p.y} r={1.6} fill={accent} fillOpacity={clampFraction(speed, scale) * 10 >= i ? 0.9 : 0.25} />;
      })}
      <Path d={arcPath(100, 100, 82, GAUGE_START_DEG, END_DEG)} fill="none" stroke={accent} strokeOpacity={0.14} strokeWidth={6} strokeLinecap="round" />
      {glow.map((g) => (
        <Path key={g.width} d={arcPath(100, 100, 82, GAUGE_START_DEG, angle)} fill="none" stroke={accent} strokeOpacity={g.opacity} strokeWidth={g.width} strokeLinecap="round" />
      ))}
      {clampFraction(speed, scale) > 0 ? (
        <>
          <Circle cx={tip.x} cy={tip.y} r={14} fill={accent} fillOpacity={0.18} />
          <Circle cx={tip.x} cy={tip.y} r={6} fill={c.onAccent} />
        </>
      ) : null}
      <SvgText x={100} y={140} textAnchor="middle" fontSize={13} fontFamily={theme.font.bold} fill={accent}>
        {unit}
      </SvgText>
    </G>
  );
}
