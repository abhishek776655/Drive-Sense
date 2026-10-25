import {BlurMask, Canvas, Circle, Group, Line, LinearGradient, Path, RadialGradient, Skia, vec} from '@shopify/react-native-skia';
import {useEffect, useMemo, useState, type ReactNode} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Easing, interpolateColor, useDerivedValue, useSharedValue, withRepeat, withSequence, withSpring, withTiming, type SharedValue} from 'react-native-reanimated';
import {useReduceMotion} from '../../components/onboarding/motion';
import {CLUSTER_INK} from '../accents';
import {angleAt, arcPath, fraction, polar, ticks as tickList} from '../motion';

/** Sweep up and back on opening, like a real cluster's self-test. */
export const START_SWEEP_MS = 1200;

export interface ArcDialProps {
  size: number;
  value: number | null;
  max: number;
  majorStep: number;
  minorStep: number;
  accent: string;
  /** Under the big number (km/h, rpm…). */
  unit: string;
  /** Turns a tick value into its label (rpm shows thousands). */
  label?: (value: number) => string;
  /** Value from which the red band runs to the end, and how hot it glows (0–1). */
  redline?: number;
  redHeat?: number;
  /** Settle time of the needle-like smoothing; RPM moves faster than speed. */
  settleMs?: number;
  /** Shown under the number (the gear box). */
  footer?: ReactNode;
  /** Number shown in the middle; defaults to the rounded value. */
  display?: string;
  /** Size of the middle number against the dial (longer numbers, like RPM, need less). */
  numberScale?: number;
}

/** One tick: grey, and lit in the accent while the arc covers it. */
function Tick({cx, cy, r, share, major, progress, accent, k}: {cx: number; cy: number; r: number; share: number; major: boolean; progress: SharedValue<number>; accent: string; k: number}) {
  const deg = angleAt(share);
  const outer = polar(cx, cy, r, deg);
  const inner = polar(cx, cy, r - (major ? 14 : 7) * k, deg);
  const color = useDerivedValue(() => (progress.value >= share - 0.002 ? accent : CLUSTER_INK.tick));
  return <Line p1={vec(outer.x, outer.y)} p2={vec(inner.x, inner.y)} color={color} strokeWidth={(major ? 2.4 : 1.2) * Math.max(0.7, k)} strokeCap="round" />;
}

/**
 * A cluster dial drawn on the GPU (spec 2026-10-25, cluster mode, section 4): track, ticks that
 * light as the arc passes, the lit arc as a sharp core, glow and bloom, an afterglow that fades
 * when the value drops, a red band that heats near the redline, and ambient light behind the dial.
 */
export function ArcDial({size, value, max, majorStep, minorStep, accent, unit, label = (v) => String(v), redline, redHeat = 0, settleMs = 300, footer, display, numberScale = 0.21}: ArcDialProps) {
  const reduce = useReduceMotion();
  const [swept, setSwept] = useState(false);
  const ready = reduce || swept;
  const progress = useSharedValue(0);
  const trail = useSharedValue(0);
  const heat = useSharedValue(0);
  const pulse = useSharedValue(0);

  // Strokes, blur and ticks scale with the dial, so it reads the same as a card or full screen.
  const k = Math.min(1, size / 300);
  const showLabels = size >= 220;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 18 * k;
  const full = useMemo(() => Skia.Path.MakeFromSVGString(arcPath(cx, cy, r, 0, 1))!, [cx, cy, r]);
  const red = useMemo(() => (redline != null ? Skia.Path.MakeFromSVGString(arcPath(cx, cy, r, fraction(redline, max), 1)) : null), [cx, cy, r, redline, max]);
  const tickMarks = useMemo(() => tickList(max, majorStep, minorStep), [max, majorStep, minorStep]);

  // Start-up sweep, then live values.
  useEffect(() => {
    if (reduce) {
      return;
    }
    const ease = Easing.inOut(Easing.cubic);
    progress.set(withSequence(withTiming(1, {duration: START_SWEEP_MS / 2, easing: ease}), withTiming(0, {duration: START_SWEEP_MS / 2, easing: ease})));
    const id = setTimeout(() => setSwept(true), START_SWEEP_MS);
    return () => clearTimeout(id);
  }, [progress, reduce]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    const target = fraction(value, max);
    // Critically damped: sweeps and settles like a needle, never overshoots.
    progress.set(withSpring(target, {dampingRatio: 1, duration: settleMs}));
    // Coming off: the lit arc above the new value fades away instead of vanishing.
    trail.set(target < trail.value && !reduce ? withTiming(target, {duration: 300, easing: Easing.out(Easing.quad)}) : withSpring(target, {dampingRatio: 1, duration: settleMs}));
  }, [value, max, ready, settleMs, progress, trail, reduce]);

  useEffect(() => {
    heat.set(withTiming(redHeat, {duration: 250}));
    pulse.set(redHeat >= 1 && !reduce ? withRepeat(withTiming(1, {duration: 250}), -1, true) : withTiming(0, {duration: 200}));
  }, [redHeat, heat, pulse, reduce]);

  const tip = useDerivedValue(() => polar(cx, cy, r, angleAt(progress.value)));
  const tipX = useDerivedValue(() => tip.value.x);
  const tipY = useDerivedValue(() => tip.value.y);
  const ambientColors = useDerivedValue(() => {
    const color = interpolateColor(pulse.value * heat.value, [0, 1], [accent, CLUSTER_INK.red]);
    return [color, 'transparent'];
  });
  const ambientOpacity = useDerivedValue(() => 0.18 + 0.5 * progress.value + 0.25 * pulse.value * heat.value);
  const redOpacity = useDerivedValue(() => 0.32 + 0.6 * heat.value);
  const trailOpacity = useDerivedValue(() => (trail.value > progress.value + 0.003 ? 0.45 : 0));

  const labelR = r - 34 * k;
  return (
    <View style={{width: size, height: size}}>
      <Canvas style={StyleSheet.absoluteFill}>
        {/* Ambient light behind the dial, following the value (red pulse at the redline). */}
        <Group opacity={ambientOpacity}>
          <Circle cx={cx} cy={cy} r={size * 0.62}>
            <RadialGradient c={vec(cx, cy)} r={size * 0.62} colors={ambientColors} />
          </Circle>
        </Group>
        {/* Face with a vignette, and a bevelled rim: light along the top, dark along the bottom. */}
        <Circle cx={cx} cy={cy} r={r + 12 * k}>
          <RadialGradient c={vec(cx, cy - r * 0.2)} r={r * 1.25} colors={[CLUSTER_INK.faceEdge, CLUSTER_INK.face, '#000000']} positions={[0, 0.7, 1]} />
        </Circle>
        <Circle cx={cx} cy={cy} r={r + 12 * k} style="stroke" strokeWidth={1.5}>
          <LinearGradient start={vec(cx, cy - r)} end={vec(cx, cy + r)} colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.04)', 'rgba(0,0,0,0.6)']} />
        </Circle>
        <Path path={full} style="stroke" strokeWidth={10 * k} strokeCap="round" color={CLUSTER_INK.track} />
        {red ? <Path path={red} style="stroke" strokeWidth={10 * k} strokeCap="round" color={CLUSTER_INK.red} opacity={redOpacity} /> : null}
        {tickMarks.map((t) => (
          <Tick key={t.value} cx={cx} cy={cy} r={r - 10 * k} share={fraction(t.value, max)} major={t.major} progress={progress} accent={accent} k={k} />
        ))}
        {/* Afterglow, bloom, glow, core. */}
        <Path path={full} start={0} end={trail} style="stroke" strokeWidth={10 * k} strokeCap="round" color={accent} opacity={trailOpacity}>
          <BlurMask blur={5 * k} style="normal" />
        </Path>
        <Path path={full} start={0} end={progress} style="stroke" strokeWidth={24 * k} strokeCap="round" color={accent} opacity={0.22}>
          <BlurMask blur={14 * k} style="normal" />
        </Path>
        <Path path={full} start={0} end={progress} style="stroke" strokeWidth={10 * k} strokeCap="round" color={accent} opacity={0.85}>
          <BlurMask blur={3 * k} style="solid" />
        </Path>
        <Path path={full} start={0} end={progress} style="stroke" strokeWidth={3 * Math.max(0.7, k)} strokeCap="round" color="rgba(255,255,255,0.85)" />
        {/* The leading edge: a bright point with its own glow. */}
        <Circle cx={tipX} cy={tipY} r={9 * k} color={accent} opacity={0.6}>
          <BlurMask blur={8 * k} style="normal" />
        </Circle>
        <Circle cx={tipX} cy={tipY} r={3.2 * Math.max(0.7, k)} color="#FFFFFF" />
      </Canvas>
      {tickMarks
        .filter((t) => showLabels && t.major)
        .map((t) => {
          const p = polar(cx, cy, labelR, angleAt(fraction(t.value, max)));
          return (
            <Text key={t.value} style={[styles.tickLabel, {left: p.x - 20, top: p.y - 8}]}>
              {label(t.value)}
            </Text>
          );
        })}
      <View style={[StyleSheet.absoluteFill, styles.centre]} pointerEvents="none">
        <Text style={[styles.number, {fontSize: size * numberScale}]}>{display ?? (value == null ? '–' : String(Math.round(value)))}</Text>
        <Text style={[styles.unit, {fontSize: 13 * Math.max(0.8, k)}]}>{unit}</Text>
        {footer}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tickLabel: {position: 'absolute', width: 40, textAlign: 'center', color: CLUSTER_INK.textDim, fontFamily: 'Nunito_700Bold', fontSize: 12, fontVariant: ['tabular-nums']},
  centre: {alignItems: 'center', justifyContent: 'center'},
  number: {color: CLUSTER_INK.text, fontFamily: 'Nunito_900Black', fontVariant: ['tabular-nums'], letterSpacing: -1},
  unit: {color: CLUSTER_INK.textDim, fontFamily: 'Nunito_700Bold', fontSize: 13, marginTop: -2, letterSpacing: 1},
});
