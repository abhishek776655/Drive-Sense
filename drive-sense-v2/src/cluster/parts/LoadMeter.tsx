import {BlurMask, Canvas, Circle, Group, LinearGradient, Path, Skia, vec} from '@shopify/react-native-skia';
import {useEffect, useMemo, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {interpolateColor, useDerivedValue, useFrameCallback, useSharedValue, withSpring, withTiming, type SharedValue} from 'react-native-reanimated';
import {useReduceMotion} from '../../components/onboarding/motion';
import {FONT} from '../../theme/theme';
import {CLUSTER_INK} from '../accents';
import {angleAt, arcPath, fraction, loadHeat, METER_START, METER_SWEEP, particleSpeed, polar} from '../motion';

const PARTICLES = 16;
/** Load trace length. */
const TRACE_MS = 30_000;

/** One light particle riding the lit part of the arc. */
function Particle({i, phase, lit, cx, cy, r, color}: {i: number; phase: SharedValue<number>; lit: SharedValue<number>; cx: number; cy: number; r: number; color: SharedValue<string>}) {
  const pos = useDerivedValue(() => {
    const along = (((i / PARTICLES + phase.value) % 1) + 1) % 1;
    return polar(cx, cy, r, angleAt(along * lit.value, METER_START, METER_SWEEP));
  });
  const x = useDerivedValue(() => pos.value.x);
  const y = useDerivedValue(() => pos.value.y);
  // Brightest in the middle of their run, fading at both ends.
  const opacity = useDerivedValue(() => {
    const along = (((i / PARTICLES + phase.value) % 1) + 1) % 1;
    return lit.value < 0.02 ? 0 : Math.sin(along * Math.PI) * 0.9;
  });
  return (
    <Group opacity={opacity}>
      <Circle cx={x} cy={y} r={2.2} color={color} />
      <Circle cx={x} cy={y} r={6} color={color} opacity={0.35}>
        <BlurMask blur={4} style="normal" />
      </Circle>
    </Group>
  );
}

/**
 * The Engine page (spec 2026-10-25, cluster mode, section 5): engine load on a half-circle power
 * meter with a throttle arc inside it, light particles that run with load (and drift back while
 * coasting), the meter turning green on a closed throttle, and the last 30 s of load as a trace.
 */
export function LoadMeter({
  width,
  height,
  loadPct,
  throttlePct,
  coasting,
  boostKpa,
  accent,
}: {
  width: number;
  height: number;
  loadPct: number | null;
  throttlePct: number | null;
  coasting: boolean;
  boostKpa: number | null;
  accent: string;
}) {
  const reduce = useReduceMotion();
  const cx = width / 2;
  const r = Math.min(width * 0.36, height * 0.52);
  const cy = r + 18;
  const meter = useMemo(() => Skia.Path.MakeFromSVGString(arcPath(cx, cy, r, 0, 1, METER_START, METER_SWEEP))!, [cx, cy, r]);
  const inner = useMemo(() => Skia.Path.MakeFromSVGString(arcPath(cx, cy, r - 16, 0, 1, METER_START, METER_SWEEP))!, [cx, cy, r]);

  const load = useSharedValue(0);
  const throttle = useSharedValue(0);
  const coast = useSharedValue(0);
  const hot = useSharedValue(0);
  const phase = useSharedValue(0);
  const speed = useSharedValue(particleSpeed(0));

  useEffect(() => {
    load.set(withSpring(coasting ? 0 : fraction(loadPct, 100), {dampingRatio: 1, duration: 280}));
    throttle.set(withSpring(fraction(throttlePct, 100), {dampingRatio: 1, duration: 200}));
    coast.set(withTiming(coasting ? 1 : 0, {duration: 400}));
    hot.set(withTiming(loadHeat(loadPct), {duration: 300}));
    // Coasting: the stream slows and runs backwards (energy coming back, not going out).
    speed.set(coasting ? -0.12 : particleSpeed(loadPct));
  }, [loadPct, throttlePct, coasting, load, throttle, coast, hot, speed]);

  useFrameCallback((frame) => {
    if (reduce) {
      return;
    }
    const dt = (frame.timeSincePreviousFrame ?? 16) / 1000;
    phase.set((phase.value + dt * speed.value) % 1);
  });

  const color = useDerivedValue(() => interpolateColor(coast.value, [0, 1], [interpolateColor(hot.value, [0, 1], [accent, CLUSTER_INK.amber]), CLUSTER_INK.green]));
  // While coasting the particles ride the whole arc (it has drained to zero).
  const lit = useDerivedValue(() => Math.max(load.value, coast.value));

  // The last 30 s of load, newest on the right.
  const [trace, setTrace] = useState<{at: number; v: number}[]>([]);
  useEffect(() => {
    if (loadPct == null) {
      return;
    }
    const now = Date.now();
    const id = setTimeout(() => setTrace((t) => [...t.filter((p) => now - p.at <= TRACE_MS), {at: now, v: coasting ? 0 : loadPct}]), 0);
    return () => clearTimeout(id);
  }, [loadPct, coasting]);
  const traceTop = cy + 34;
  const traceH = Math.max(24, height - traceTop - 8);
  const tracePath = useMemo(() => {
    if (trace.length < 2) {
      return null;
    }
    const now = trace[trace.length - 1].at;
    const left = cx - r;
    const w = r * 2;
    const pts = trace.map((p) => ({x: left + w * (1 - (now - p.at) / TRACE_MS), y: traceTop + traceH * (1 - p.v / 100)}));
    const line = pts.map((p, k) => `${k === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    return Skia.Path.MakeFromSVGString(`${line} L ${pts[pts.length - 1].x} ${traceTop + traceH} L ${pts[0].x} ${traceTop + traceH} Z`);
  }, [trace, cx, r, traceTop, traceH]);

  return (
    <View style={{width, height}}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Path path={meter} style="stroke" strokeWidth={14} strokeCap="round" color={CLUSTER_INK.track} />
        <Path path={inner} style="stroke" strokeWidth={3} strokeCap="round" color={CLUSTER_INK.track} />
        {/* Load: bloom, glow, core. */}
        <Path path={meter} start={0} end={load} style="stroke" strokeWidth={26} strokeCap="round" color={color} opacity={0.22}>
          <BlurMask blur={14} style="normal" />
        </Path>
        <Path path={meter} start={0} end={load} style="stroke" strokeWidth={14} strokeCap="round" color={color} opacity={0.9}>
          <BlurMask blur={3} style="solid" />
        </Path>
        {/* Throttle: what's asked for, against what the engine delivers. */}
        <Path path={inner} start={0} end={throttle} style="stroke" strokeWidth={3} strokeCap="round" color="rgba(255,255,255,0.75)" />
        {Array.from({length: PARTICLES}, (_, i) => (
          <Particle key={i} i={i} phase={phase} lit={lit} cx={cx} cy={cy} r={r} color={color} />
        ))}
        {tracePath ? (
          <Path path={tracePath} opacity={0.55}>
            <LinearGradient start={vec(cx - r, 0)} end={vec(cx + r, 0)} colors={['transparent', accent]} />
          </Path>
        ) : null}
      </Canvas>
      <View style={[styles.centre, {top: cy - r * 0.62, width}]} pointerEvents="none">
        <Text style={styles.big}>{loadPct == null ? '–' : `${Math.round(coasting ? 0 : loadPct)}`}</Text>
        <Text style={[styles.caption, coasting && {color: CLUSTER_INK.green}]}>{coasting ? 'COASTING · FUEL CUT' : 'ENGINE LOAD %'}</Text>
        <Text style={styles.sub}>
          {throttlePct != null ? `Throttle ${Math.round(throttlePct)}%` : ''}
          {boostKpa != null ? `  ·  Boost ${Math.round(boostKpa)} kPa` : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: {position: 'absolute', left: 0, alignItems: 'center'},
  big: {color: CLUSTER_INK.text, fontFamily: FONT.black, fontSize: 44, fontVariant: ['tabular-nums'], letterSpacing: -1},
  caption: {color: CLUSTER_INK.textDim, fontFamily: FONT.extrabold, fontSize: 11, letterSpacing: 1.4},
  sub: {color: CLUSTER_INK.textFaint, fontFamily: FONT.bold, fontSize: 12, marginTop: 4},
});
