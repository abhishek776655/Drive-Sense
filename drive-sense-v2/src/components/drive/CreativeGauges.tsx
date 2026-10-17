import {useId} from 'react';
import {Circle, ClipPath, Defs, G, Line, Path, Rect, Text as SvgText} from 'react-native-svg';
import type {AppTheme} from '../../theme/theme';
import {arcPath, clampFraction, GAUGE_START_DEG, polar, valueToAngle} from '../../utils/gaugeMath';
import {speedColor} from '../../utils/speedColor';

/**
 * The newer dial faces, each drawn on the same 200 × 200 grid as `GaugeDial`'s originals:
 * Ring (activity-ring gradient), Retro (80s segmented LEDs), HUD (aviation speed tape),
 * Heritage (Porsche-style round dial) and Neon (glowing arc). The speed number is laid over them
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

/** Activity-ring style: a thick ring that runs through the trip page's speed colours as it fills. */
export function RingFace({speed, scale, toKmh, unit, theme}: FaceProps) {
  const c = theme.colors;
  const start = 120;
  const sweep = 300;
  const r = 82;
  const fraction = clampFraction(speed, scale);
  const pieces = Math.ceil(fraction * 60);
  return (
    <G>
      <Path d={arcPath(100, 100, r, start, start + sweep)} fill="none" stroke={c.separator} strokeWidth={20} strokeLinecap="round" />
      {Array.from({length: pieces}, (_, i) => {
        const a = start + (sweep * i) / 60;
        const b = Math.min(start + sweep * fraction, a + sweep / 60 + 0.6);
        const kmh = (scale * (i + 0.5)) / 60 * toKmh;
        return <Path key={i} d={arcPath(100, 100, r, a, b)} fill="none" stroke={speedColor(kmh, c)} strokeWidth={20} />;
      })}
      {fraction > 0 ? (
        <>
          <Circle {...polar(100, 100, r, start)} r={10} fill={speedColor(0, c)} />
          <Circle {...polar(100, 100, r, start + sweep * fraction)} r={10} fill={speedColor(speed * toKmh, c)} />
        </>
      ) : null}
      <SvgText x={100} y={140} textAnchor="middle" fontSize={13} fontFamily={theme.font.bold} fill={c.textSecondary}>
        {unit}
      </SvgText>
    </G>
  );
}

const SEGMENTS = 27;

/** 80s LED cluster (Nissan 300ZX): segments light up green, then amber, then red near the top. */
export function RetroFace({speed, scale, unit, theme}: FaceProps) {
  const c = theme.colors;
  const lit = clampFraction(speed, scale) * SEGMENTS;
  const each = 270 / SEGMENTS;
  return (
    <G>
      <Circle cx={100} cy={100} r={97} fill={c.card} fillOpacity={0.4} stroke={c.separator} strokeWidth={1.5} />
      {Array.from({length: SEGMENTS}, (_, i) => {
        const a = GAUGE_START_DEG + i * each + 1.2;
        const zone = i / SEGMENTS;
        const color = zone < 0.6 ? c.green : zone < 0.85 ? c.amber : c.red;
        const on = i + 0.5 <= lit;
        return <Path key={i} d={arcPath(100, 100, 80, a, a + each - 2.4)} fill="none" stroke={on ? color : c.textTertiary} strokeOpacity={on ? 1 : 0.22} strokeWidth={18} />;
      })}
      <SvgText x={100} y={142} textAnchor="middle" fontSize={12} fontFamily={theme.font.extrabold} fill={c.textSecondary} letterSpacing={1.5}>
        {unit.toUpperCase()}
      </SvgText>
    </G>
  );
}

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

/** Porsche-style round dial: fine ticks, round-number labels, long red needle, digital window. */
export function HeritageFace({speed, scale, unit, theme}: FaceProps) {
  const c = theme.colors;
  const step = niceStep(scale);
  const minor = step / 4;
  const ticks: number[] = [];
  for (let v = 0; v <= scale + 0.001; v += minor) {
    ticks.push(v);
  }
  const angle = valueToAngle(speed, scale);
  const tip = polar(100, 100, 82, angle);
  const tail = polar(100, 100, 16, angle + 180);
  return (
    <G>
      <Circle cx={100} cy={100} r={97} fill={c.card} stroke={c.textPrimary} strokeOpacity={0.12} strokeWidth={3} />
      {ticks.map((v, i) => {
        const a = valueToAngle(v, scale);
        const major = Math.abs(v / step - Math.round(v / step)) < 0.001;
        const outer = polar(100, 100, 90, a);
        const inner = polar(100, 100, major ? 78 : 84, a);
        return <Line key={i} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={c.textPrimary} strokeOpacity={major ? 0.85 : 0.35} strokeWidth={major ? 2.4 : 1.2} />;
      })}
      {ticks
        .filter((v) => Math.abs(v / step - Math.round(v / step)) < 0.001)
        .map((v) => {
          const p = polar(100, 100, 64, valueToAngle(v, scale));
          return (
            <SvgText key={v} x={p.x} y={p.y + 4} textAnchor="middle" fontSize={11} fontFamily={theme.font.extrabold} fill={c.textPrimary}>
              {Math.round(v)}
            </SvgText>
          );
        })}
      <Rect x={72} y={126} width={56} height={28} rx={8} fill={c.canvas} stroke={c.separator} strokeWidth={1} />
      <SvgText x={100} y={170} textAnchor="middle" fontSize={9} fontFamily={theme.font.bold} fill={c.textSecondary}>
        {unit}
      </SvgText>
      <Line x1={tail.x} y1={tail.y} x2={tip.x} y2={tip.y} stroke={c.red} strokeWidth={3} strokeLinecap="round" />
      <Circle cx={100} cy={100} r={7} fill={c.textPrimary} />
      <Circle cx={100} cy={100} r={2.5} fill={c.red} />
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
