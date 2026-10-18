import {useEffect, useId, useState} from 'react';
import {Circle, ClipPath, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText} from 'react-native-svg';
import {arcPath, clampFraction, GAUGE_START_DEG, polar, valueToAngle} from '../../utils/gaugeMath';
import {GAUGE_INK, type NeedleTheme, type RoadTheme} from '../../theme/gaugeThemes';
import {niceStep, type FaceProps} from './CreativeGauges';

/**
 * Vehicle-themed dials on `GaugeDial`'s 200 × 200 grid: a needle gauge in each vehicle's colours
 * (Rovy's set), and three road scenes. The speed number is laid over them by `GaugeDial`. Colours
 * are fixed per style on purpose: each dial looks the same in light and dark mode, like a real one.
 */
/** Colour at `f` (0..1) along a list of hex stops. */
const mix = (stops: string[], f: number): string => {
  if (stops.length === 1) {
    return stops[0];
  }
  const x = Math.min(Math.max(f, 0), 1) * (stops.length - 1);
  const i = Math.min(Math.floor(x), stops.length - 2);
  const t = x - i;
  const a = stops[i].replace('#', '');
  const b = stops[i + 1].replace('#', '');
  const ch = (k: number) => Math.round(parseInt(a.slice(k, k + 2), 16) * (1 - t) + parseInt(b.slice(k, k + 2), 16) * t);
  return `#${[0, 2, 4].map((k) => ch(k).toString(16).padStart(2, '0')).join('')}`;
};

const END_DEG = GAUGE_START_DEG + 270;
const SEGMENTS = 36;

/** The themed needle gauge: rim, face, a gradient arc that lights up to the speed, numbers and a needle. */
export function ThemedNeedle({speed, scale, unit, t}: Pick<FaceProps, 'speed' | 'scale' | 'unit'> & {t: NeedleTheme}) {
  const id = useId().replace(/:/g, '');
  const fraction = clampFraction(speed, scale);
  const angle = valueToAngle(speed, scale);
  const step = niceStep(scale, 9);
  const labels = Array.from({length: Math.floor(scale / step) + 1}, (_, i) => i * step);
  const tip = polar(100, 100, 74, angle);
  const tail = polar(100, 100, 12, angle + 180);
  return (
    <G>
      <Defs>
        <LinearGradient id={`face${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={t.faceInner ?? t.face} />
          <Stop offset="1" stopColor={t.face} />
        </LinearGradient>
      </Defs>
      <Circle cx={100} cy={100} r={97} fill={`url(#face${id})`} stroke={t.rim} strokeWidth={4} />
      <Circle cx={100} cy={100} r={92} fill="none" stroke={t.rim} strokeOpacity={0.35} strokeWidth={1} />
      {/* The arc in short segments, each in its colour; lit up to the speed, faint beyond it. */}
      {Array.from({length: SEGMENTS}, (_, i) => {
        const a0 = GAUGE_START_DEG + (270 * i) / SEGMENTS;
        const a1 = GAUGE_START_DEG + (270 * (i + 1)) / SEGMENTS + 0.6;
        const lit = (i + 0.5) / SEGMENTS <= fraction;
        return <Path key={i} d={arcPath(100, 100, 86, a0, a1)} fill="none" stroke={mix(t.arc, i / (SEGMENTS - 1))} strokeOpacity={lit ? 1 : 0.18} strokeWidth={6} />;
      })}
      {/* Ticks: a long one at each label, short ones between. */}
      {Array.from({length: labels.length * 2 - 1}, (_, i) => {
        const major = i % 2 === 0;
        const a = GAUGE_START_DEG + (270 * i) / ((labels.length - 1) * 2);
        const outer = polar(100, 100, 80, a);
        const inner = polar(100, 100, major ? 71 : 75, a);
        return <Line key={i} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={t.tick} strokeWidth={major ? 1.6 : 1} strokeLinecap="round" />;
      })}
      {labels.map((v) => {
        const p = polar(100, 100, 61, GAUGE_START_DEG + (270 * v) / scale);
        return (
          <SvgText key={v} x={p.x} y={p.y + 3} textAnchor="middle" fontSize={8.5} fontWeight="700" fill={t.number}>
            {v}
          </SvgText>
        );
      })}
      {t.shiftLights
        ? Array.from({length: 7}, (_, i) => {
            const on = fraction >= 0.35 + i * 0.09;
            const color = i < 3 ? GAUGE_INK.shiftGreen : i < 5 ? GAUGE_INK.shiftYellow : GAUGE_INK.shiftRed;
            return <Circle key={i} cx={73 + i * 9} cy={52} r={2.6} fill={color} fillOpacity={on ? 1 : 0.2} />;
          })
        : null}
      <SvgText x={100} y={170} textAnchor="middle" fontSize={8} fontWeight="700" fill={t.number} fillOpacity={0.7}>
        {unit}
      </SvgText>
      <Line x1={tail.x} y1={tail.y} x2={tip.x} y2={tip.y} stroke={t.needle} strokeWidth={2.6} strokeLinecap="round" />
      <Circle cx={100} cy={100} r={5} fill={t.hub} />
    </G>
  );
}


const ROAD_MARKS = 7;

/**
 * 0..1, advancing with the speed so the road scene's marks keep rushing past while you drive (one
 * mark per ~0.5 s at 60 km/h); standing still, it holds.
 */
function useRoadPhase(speed: number): number {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (speed <= 0.5) {
      return;
    }
    let raf = 0;
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      setPhase((p) => (p + dt * Math.min(speed, 200) * 0.035) % 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speed]);
  return phase;
}

/** Road scenes: a sky over a road running to the horizon, the speed big at the top (Open, Daylight, Sunset). */
export function RoadFace({speed, scale, t}: Pick<FaceProps, 'speed' | 'scale'> & {t: RoadTheme}) {
  const id = useId().replace(/:/g, '');
  const fraction = clampFraction(speed, scale);
  const phase = useRoadPhase(speed);
  const HORIZON = 112;
  const depth = (k: number) => ((k + phase) / ROAD_MARKS) ** 2.2;
  const yAt = (d: number) => HORIZON + (200 - HORIZON) * d;
  return (
    <G>
      <Defs>
        <ClipPath id={`clip${id}`}>
          <Circle cx={100} cy={100} r={97} />
        </ClipPath>
        <LinearGradient id={`sky${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={t.sky[0]} />
          <Stop offset="1" stopColor={t.sky[1]} />
        </LinearGradient>
        <LinearGradient id={`ground${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={t.ground[0]} />
          <Stop offset="1" stopColor={t.ground[1]} />
        </LinearGradient>
      </Defs>
      <G clipPath={`url(#clip${id})`}>
        <Rect x={0} y={0} width={200} height={112} fill={`url(#sky${id})`} />
        <Rect x={0} y={112} width={200} height={88} fill={`url(#ground${id})`} />
        {t.light === 'moon' ? <Path d="M150 38 a9 9 0 1 0 8 13 a7 7 0 1 1 -8 -13 Z" fill={GAUGE_INK.moon} /> : null}
        {t.light === 'sun' ? <Circle cx={152} cy={44} r={9} fill={GAUGE_INK.sun} /> : null}
        {t.light === 'sunset' ? <Circle cx={100} cy={112} r={18} fill={GAUGE_INK.sunset} fillOpacity={0.85} /> : null}
        <Path d="M96 112 L104 112 L150 200 L50 200 Z" fill={t.road} />
        <Path d="M96 112 L50 200" stroke={t.line} strokeWidth={1.5} strokeOpacity={0.8} />
        <Path d="M104 112 L150 200" stroke={t.line} strokeWidth={1.5} strokeOpacity={0.8} />
        {/* Lane dashes and roadside posts rushing towards you, bigger as they get closer. */}
        {Array.from({length: ROAD_MARKS}, (_, k) => {
          const d = depth(k);
          const y = yAt(d);
          const len = 2 + 16 * d;
          return <Line key={`dash${k}`} x1={100} y1={y} x2={100} y2={Math.min(200, y + len)} stroke={t.line} strokeWidth={0.8 + 2.4 * d} strokeOpacity={0.35 + 0.65 * d} strokeLinecap="round" />;
        })}
        {Array.from({length: ROAD_MARKS}, (_, k) => {
          const d = depth(k + 0.5);
          const y = yAt(d);
          const half = 4 + 60 * d;
          const h = 1 + 9 * d;
          return (
            <G key={`post${k}`} opacity={0.25 + 0.6 * d}>
              <Line x1={100 - half - 4 * d} y1={y} x2={100 - half - 4 * d} y2={y - h} stroke={t.line} strokeWidth={0.6 + 1.6 * d} strokeLinecap="round" />
              <Line x1={100 + half + 4 * d} y1={y} x2={100 + half + 4 * d} y2={y - h} stroke={t.line} strokeWidth={0.6 + 1.6 * d} strokeLinecap="round" />
            </G>
          );
        })}
      </G>
      <Circle cx={100} cy={100} r={97} fill="none" stroke={GAUGE_INK.rim} strokeOpacity={0.18} strokeWidth={3} />
      {/* How fast, as a thin bar along the rim. */}
      <Path d={arcPath(100, 100, 92, GAUGE_START_DEG, END_DEG)} fill="none" stroke={GAUGE_INK.rim} strokeOpacity={0.12} strokeWidth={3} strokeLinecap="round" />
      {fraction > 0 ? <Path d={arcPath(100, 100, 92, GAUGE_START_DEG, GAUGE_START_DEG + 270 * fraction)} fill="none" stroke={GAUGE_INK.rim} strokeWidth={3} strokeLinecap="round" /> : null}
    </G>
  );
}

