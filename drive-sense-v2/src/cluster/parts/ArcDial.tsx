import {BlurMask, Canvas, Circle, Group, Line, LinearGradient, Path, RadialGradient, Skia, vec} from '@shopify/react-native-skia';
import {useEffect, useMemo, useState, type ReactNode} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Easing, interpolateColor, useDerivedValue, useSharedValue, withRepeat, withSequence, withSpring, withTiming, type SharedValue} from 'react-native-reanimated';
import {useReduceMotion} from '../../components/onboarding/motion';
import {CLUSTER_INK, type DialStyle} from '../accents';
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
  /** A glowing arc, or a needle over a faint arc; switching crossfades between them. */
  dialStyle?: DialStyle;
}

/** One tick: grey, and lit in the accent while the arc covers it; plain white marks in needle style, black ink on the Classic face. */
function Tick({cx, cy, r, share, major, progress, needle, paper, accent, k}: {cx: number; cy: number; r: number; share: number; major: boolean; progress: SharedValue<number>; needle: SharedValue<number>; paper: SharedValue<number>; accent: string; k: number}) {
  const deg = angleAt(share);
  const outer = polar(cx, cy, r, deg);
  const inner = polar(cx, cy, r - (major ? 14 : 7) * k, deg);
  const color = useDerivedValue(() =>
    paper.value > 0.5 ? (major ? CLUSTER_INK.ink : CLUSTER_INK.inkDim) : needle.value > 0.5 ? (major ? CLUSTER_INK.text : CLUSTER_INK.tick) : progress.value >= share - 0.002 ? accent : CLUSTER_INK.tick,
  );
  return <Line p1={vec(outer.x, outer.y)} p2={vec(inner.x, inner.y)} color={color} strokeWidth={(major ? 2.4 : 1.2) * Math.max(0.7, k)} strokeCap="round" />;
}

/** LED style: how many bars make up the ring. */
const SEGMENTS = 44;

/** One LED bar across the arc: dark until the value reaches it, then lit (red past the redline). */
function Segment({i, cx, cy, r, k, progress, accent, redShare}: {i: number; cx: number; cy: number; r: number; k: number; progress: SharedValue<number>; accent: string; redShare: number}) {
  const share = (i + 0.5) / SEGMENTS;
  const deg = angleAt(share);
  const outer = polar(cx, cy, r + 6 * k, deg);
  const inner = polar(cx, cy, r - 6 * k, deg);
  const lit = share >= redShare ? CLUSTER_INK.red : accent;
  const color = useDerivedValue(() => (progress.value >= share ? lit : CLUSTER_INK.track));
  return <Line p1={vec(inner.x, inner.y)} p2={vec(outer.x, outer.y)} color={color} strokeWidth={Math.max(2, 4.2 * k)} strokeCap="round" />;
}

/**
 * A cluster dial drawn on the GPU (spec 2026-10-25, cluster mode, section 4): track, ticks that
 * light as the arc passes, the lit arc as a sharp core, glow and bloom, an afterglow that fades
 * when the value drops, a red band that heats near the redline, and ambient light behind the dial.
 * LED style lights a ring of separate bars instead. Vintage ('classic') is Drive's Vintage gauge: a
 * cream face, brass bezel, long dark needle on a hub, figures below it. Needle style is on the dark face: plain white ticks on a thin ring, and a glowing needle
 * that starts out from the centre, leaving the number in the middle clear.
 */
export function ArcDial({size, value, max, majorStep, minorStep, accent, unit, label = (v) => String(v), redline, redHeat = 0, settleMs = 300, footer, display, numberScale = 0.21, dialStyle = 'arc'}: ArcDialProps) {
  const reduce = useReduceMotion();
  const [swept, setSwept] = useState(false);
  const ready = reduce || swept;
  const progress = useSharedValue(0);
  const trail = useSharedValue(0);
  const heat = useSharedValue(0);
  const pulse = useSharedValue(0);
  const needle = useSharedValue(dialStyle === 'needle' ? 1 : 0);
  const segment = useSharedValue(dialStyle === 'segment' ? 1 : 0);
  const paper = useSharedValue(dialStyle === 'classic' ? 1 : 0);

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
    const fade = (on: boolean) => (reduce ? (on ? 1 : 0) : withTiming(on ? 1 : 0, {duration: 380, easing: Easing.inOut(Easing.quad)}));
    needle.set(fade(dialStyle === 'needle'));
    segment.set(fade(dialStyle === 'segment'));
    paper.set(fade(dialStyle === 'classic'));
  }, [dialStyle, needle, segment, paper, reduce]);

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
  // A white face is lit already; its halo stays faint.
  const ambientOpacity = useDerivedValue(() => (0.18 + 0.5 * progress.value + 0.25 * pulse.value * heat.value) * (1 - 0.8 * paper.value));
  // In LED style the bars turn red themselves, so the band behind them steps back.
  const redOpacity = useDerivedValue(() => (0.32 + 0.6 * heat.value) * (1 - 0.7 * segment.value));
  // How much of the plain arc style shows (the other styles fade it out).
  const plain = useDerivedValue(() => (1 - needle.value) * (1 - segment.value) * (1 - paper.value));
  // Classic is a needle gauge too, printed on a white face.
  const needleShown = useDerivedValue(() => Math.max(needle.value, paper.value));
  const trailOpacity = useDerivedValue(() => (trail.value > progress.value + 0.003 ? 0.45 * plain.value : 0));
  // Arc style lights the arc; needle style has no lit arc at all, only the needle.
  const arcOpacity = plain;
  const bloomOpacity = useDerivedValue(() => 0.22 * plain.value);
  const glowOpacity = useDerivedValue(() => 0.85 * plain.value);
  const coreOpacity = useDerivedValue(() => 0.85 * plain.value);
  const tipOpacity = plain;
  const tipGlowOpacity = useDerivedValue(() => 0.6 * plain.value);
  // LED style: a soft glow under the lit segments.
  const segmentGlow = useDerivedValue(() => 0.4 * segment.value);
  const redShare = redline != null ? fraction(redline, max) : 2;
  // The needle: a tapered blade from a little way out from the centre to the ticks, drawn
  // pointing at 0° and turned to the value; the number sits in the clear middle.
  const hubR = r * 0.44;
  const blade = useMemo(() => {
    const root = r * 0.42;
    const tip = r - 2 * k;
    const w = 4.2 * k;
    const p = Skia.Path.Make();
    // Wide at the root, a long even taper, and a rounded tip.
    p.moveTo(cx + root, cy - w);
    p.lineTo(cx + tip - 2 * k, cy - 1.1 * k);
    p.quadTo(cx + tip + 1 * k, cy, cx + tip - 2 * k, cy + 1.1 * k);
    p.lineTo(cx + root, cy + w);
    p.quadTo(cx + root - 3 * k, cy, cx + root, cy - w);
    p.close();
    return p;
  }, [cx, cy, r, k]);
  const needleTurn = useDerivedValue(() => [{rotate: (angleAt(progress.value) * Math.PI) / 180}]);
  // Vintage: a long needle from a short tail behind the hub, the number sitting below the hub.
  const longBlade = useMemo(() => {
    const tail = r * 0.18;
    const tip = r - 6 * k;
    const p = Skia.Path.Make();
    p.moveTo(cx - tail, cy - 3.4 * k);
    p.lineTo(cx + tip, cy - 0.8 * k);
    p.lineTo(cx + tip, cy + 0.8 * k);
    p.lineTo(cx - tail, cy + 3.4 * k);
    p.close();
    return p;
  }, [cx, cy, r, k]);
  // A soft shadow sits under the needles.
  const shadowTurn = useDerivedValue(() => [{translateX: 3 * k}, {translateY: 5 * k}, {rotate: (angleAt(progress.value) * Math.PI) / 180}]);
  const needleOnly = needle;

  // Far enough in that the numbers clear the major ticks (which reach r − 24k).
  const labelR = r - 42 * k;
  const needleLike = dialStyle === 'needle';
  const onPaper = dialStyle === 'classic';
  const needleColor = accent;
  return (
    <View style={{width: size, height: size}}>
      <Canvas style={StyleSheet.absoluteFill}>
        {/* Ambient light behind the dial, following the value (red pulse at the redline). */}
        <Group opacity={ambientOpacity}>
          {/* Fades out inside the canvas, so its square edge never shows. */}
          <Circle cx={cx} cy={cy} r={size / 2}>
            <RadialGradient c={vec(cx, cy)} r={size / 2} colors={ambientColors} />
          </Circle>
        </Group>
        {/* Face with a vignette, and a bevelled rim: light along the top, dark along the bottom. */}
        <Circle cx={cx} cy={cy} r={r + 12 * k}>
          <RadialGradient c={vec(cx, cy - r * 0.2)} r={r * 1.25} colors={[CLUSTER_INK.faceEdge, CLUSTER_INK.face, '#000000']} positions={[0, 0.7, 1]} />
        </Circle>
        <Circle cx={cx} cy={cy} r={r + 12 * k} style="stroke" strokeWidth={1.5}>
          <LinearGradient start={vec(cx, cy - r)} end={vec(cx, cy + r)} colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.04)', 'rgba(0,0,0,0.6)']} />
        </Circle>
        {/* Classic: an ivory face under a chrome bezel, with a fine ink ring for the ticks. */}
        <Group opacity={paper}>
          <Circle cx={cx} cy={cy} r={r + 12 * k}>
            <RadialGradient c={vec(cx, cy - r * 0.25)} r={r * 1.3} colors={[CLUSTER_INK.paper, CLUSTER_INK.paper, CLUSTER_INK.paperEdge]} positions={[0, 0.65, 1]} />
          </Circle>
          <Circle cx={cx} cy={cy} r={r + 12 * k} style="stroke" strokeWidth={6 * k}>
            <LinearGradient start={vec(cx, cy - r)} end={vec(cx, cy + r)} colors={[CLUSTER_INK.chromeLight, CLUSTER_INK.chromeDark, CLUSTER_INK.chromeLight]} />
          </Circle>
          <Path path={full} style="stroke" strokeWidth={1.4 * Math.max(0.7, k)} strokeCap="round" color={CLUSTER_INK.inkFaint} />
        </Group>
        <Path path={full} style="stroke" strokeWidth={10 * k} strokeCap="round" color={CLUSTER_INK.track} opacity={arcOpacity} />
        {/* Needle style: a thin ring for the ticks to stand on, and an inner bezel. */}
        <Group opacity={needle}>
          <Path path={full} style="stroke" strokeWidth={1.6 * Math.max(0.7, k)} strokeCap="round" color={CLUSTER_INK.tick} />
          <Circle cx={cx} cy={cy} r={r * 0.62} style="stroke" strokeWidth={1} color={CLUSTER_INK.track} />
        </Group>
        {red ? <Path path={red} style="stroke" strokeWidth={10 * k} strokeCap="round" color={CLUSTER_INK.red} opacity={redOpacity} /> : null}
        {tickMarks.map((t) => (
          <Tick key={t.value} cx={cx} cy={cy} r={r - 10 * k} share={fraction(t.value, max)} major={t.major} progress={progress} needle={needle} paper={paper} accent={accent} k={k} />
        ))}
        {/* Afterglow, bloom, glow, core. */}
        <Path path={full} start={0} end={trail} style="stroke" strokeWidth={10 * k} strokeCap="round" color={accent} opacity={trailOpacity}>
          <BlurMask blur={5 * k} style="normal" />
        </Path>
        <Path path={full} start={0} end={progress} style="stroke" strokeWidth={24 * k} strokeCap="round" color={accent} opacity={bloomOpacity}>
          <BlurMask blur={14 * k} style="normal" />
        </Path>
        <Path path={full} start={0} end={progress} style="stroke" strokeWidth={10 * k} strokeCap="round" color={accent} opacity={glowOpacity}>
          <BlurMask blur={3 * k} style="solid" />
        </Path>
        <Path path={full} start={0} end={progress} style="stroke" strokeWidth={3 * Math.max(0.7, k)} strokeCap="round" color="#FFFFFF" opacity={coreOpacity} />
        {/* The leading edge: a bright point with its own glow. */}
        <Circle cx={tipX} cy={tipY} r={9 * k} color={accent} opacity={tipGlowOpacity}>
          <BlurMask blur={8 * k} style="normal" />
        </Circle>
        <Circle cx={tipX} cy={tipY} r={3.2 * Math.max(0.7, k)} color="#FFFFFF" opacity={tipOpacity} />
        {/* LED style: a ring of separate bars that light one by one, red into the redline. */}
        <Path path={full} start={0} end={progress} style="stroke" strokeWidth={16 * k} color={accent} opacity={segmentGlow}>
          <BlurMask blur={10 * k} style="normal" />
        </Path>
        <Group opacity={segment}>
          {Array.from({length: SEGMENTS}, (_, i) => (
            <Segment key={i} i={i} cx={cx} cy={cy} r={r} k={k} progress={progress} accent={accent} redShare={redShare} />
          ))}
        </Group>
        {/* Needle style: the edge fills with light as the value rises, a glowing bead riding its end. */}
        <Group opacity={needleOnly}>
          <Path path={full} start={0} end={progress} style="stroke" strokeWidth={14 * k} strokeCap="round" color={accent} opacity={0.28}>
            <BlurMask blur={9 * k} style="normal" />
          </Path>
          <Path path={full} start={0} end={progress} style="stroke" strokeWidth={4 * k} strokeCap="round" color={accent} />
          <Path path={full} start={0} end={progress} style="stroke" strokeWidth={1.2 * Math.max(0.7, k)} strokeCap="round" color="#FFFFFF" opacity={0.7} />
        </Group>
        {/* Then a soft shadow under the needle, the blade with its glow, and a bright tip. */}
        <Group opacity={needleShown}>
          <Group transform={shadowTurn} origin={vec(cx, cy)}>
            <Path path={onPaper ? longBlade : blade} color="#000000" opacity={onPaper ? 0.25 : 0.55}>
              <BlurMask blur={4 * k} style="normal" />
            </Path>
          </Group>
        </Group>
        <Group opacity={needleOnly}>
          <Group transform={needleTurn} origin={vec(cx, cy)}>
            <Path path={blade} color={needleColor} opacity={0.55}>
              <BlurMask blur={8 * k} style="normal" />
            </Path>
            {/* Darker at the root, full accent towards the tip. */}
            <Path path={blade}>
              <LinearGradient start={vec(cx + r * 0.42, cy)} end={vec(cx + r, cy)} colors={[CLUSTER_INK.faceEdge, needleColor, needleColor]} positions={[0, 0.45, 1]} />
            </Path>
            <Line p1={vec(cx + r * 0.62, cy)} p2={vec(cx + r - 5 * k, cy)} color="#FFFFFF" strokeWidth={1.1 * Math.max(0.7, k)} strokeCap="round" opacity={0.75} />
            <Circle cx={cx + r - 3 * k} cy={cy} r={3 * k} color="#FFFFFF">
              <BlurMask blur={2 * k} style="solid" />
            </Circle>
          </Group>
        </Group>
        {/* Vintage: the long dark needle on a brass hub. */}
        <Group opacity={paper}>
          <Group transform={needleTurn} origin={vec(cx, cy)}>
            <Path path={longBlade} color={CLUSTER_INK.vintageNeedle} />
          </Group>
          <Circle cx={cx} cy={cy} r={10 * k} color={CLUSTER_INK.vintageHub} />
          <Circle cx={cx} cy={cy} r={3.5 * k} color={CLUSTER_INK.vintageNeedle} />
        </Group>
      </Canvas>
      {tickMarks
        .filter((t) => showLabels && t.major)
        .map((t) => {
          const p = polar(cx, cy, labelR, angleAt(fraction(t.value, max)));
          return (
            <Text key={t.value} style={[styles.tickLabel, {left: p.x - 20, top: p.y - 8}, onPaper && {color: CLUSTER_INK.ink}]}>
              {label(t.value)}
            </Text>
          );
        })}
      {/* Vintage puts the figures below the hub, as on Drive's Vintage gauge; the others centre them. */}
      <View style={[StyleSheet.absoluteFill, onPaper ? {alignItems: 'center', paddingTop: cy + r * 0.2} : styles.centre]} pointerEvents="none">
        {/* Needle style keeps the figures in the clear middle, a little smaller. */}
        <Text style={[styles.number, {fontSize: size * numberScale * (onPaper ? 0.6 : needleLike ? 0.78 : 1)}, onPaper && {color: CLUSTER_INK.ink}]}>{display ?? (value == null ? '–' : String(Math.round(value)))}</Text>
        <Text style={[styles.unit, {fontSize: 13 * Math.max(0.8, k)}, onPaper && {color: CLUSTER_INK.inkDim}]}>{unit}</Text>
        {needleLike ? null : footer}
      </View>
      {/* Needle style: the gear and readouts sit below the clear middle, out of the needle's root. */}
      {needleLike ? (
        <View style={[styles.below, {top: cy + hubR + 4 * k}]} pointerEvents="none">
          {footer}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tickLabel: {position: 'absolute', width: 40, textAlign: 'center', color: CLUSTER_INK.textDim, fontFamily: 'Nunito_700Bold', fontSize: 12, fontVariant: ['tabular-nums']},
  centre: {alignItems: 'center', justifyContent: 'center'},
  below: {position: 'absolute', left: 0, right: 0, alignItems: 'center'},
  number: {color: CLUSTER_INK.text, fontFamily: 'Nunito_900Black', fontVariant: ['tabular-nums'], letterSpacing: -1},
  unit: {color: CLUSTER_INK.textDim, fontFamily: 'Nunito_700Bold', fontSize: 13, marginTop: -2, letterSpacing: 1},
});
