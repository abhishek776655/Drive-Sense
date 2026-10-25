import {Canvas, Circle, Group, Line, LinearGradient, Path, Rect, Skia, SweepGradient, vec} from '@shopify/react-native-skia';
import {useEffect, useMemo} from 'react';
import {StyleSheet, Text} from 'react-native';
import {useDerivedValue, useFrameCallback, useSharedValue, type SharedValue} from 'react-native-reanimated';
import {arcPath, GAUGE_START_DEG, niceStep, polar} from '../../utils/gaugeMath';
import {GAUGE_INK, type NeedleTheme, type RoadTheme} from '../../theme/gaugeThemes';
import {useReduceMotion} from '../onboarding/motion';
import {angleOf} from './gaugeMotion';

/**
 * Vehicle-themed dials on `GaugeDial`'s 200 × 200 grid, drawn with Skia: a needle gauge in each
 * vehicle's colours (Rovy's set), and three road scenes. The speed number is laid over them by
 * `GaugeDial`. Colours are fixed per style on purpose: each dial looks the same in light and dark
 * mode, like a real one.
 */

const END_DEG = GAUGE_START_DEG + 270;

function ShiftLight({i, share}: {i: number; share: SharedValue<number>}) {
  const color = i < 3 ? GAUGE_INK.shiftGreen : i < 5 ? GAUGE_INK.shiftYellow : GAUGE_INK.shiftRed;
  const opacity = useDerivedValue(() => (share.value >= 0.35 + i * 0.09 ? 1 : 0.2));
  return <Circle cx={73 + i * 9} cy={52} r={2.6} color={color} opacity={opacity} />;
}

/** The themed needle gauge: rim, face, a gradient arc that lights up to the speed, numbers and a needle. */
export function ThemedNeedle({share, scale, unit, size, t}: {share: SharedValue<number>; scale: number; unit: string; size: number; t: NeedleTheme}) {
  const k = size / 200;
  // Drawn from 0° and turned into place, so the colour sweep runs 0–270° without wrapping past 360°.
  const arc = useMemo(() => Skia.Path.MakeFromSVGString(arcPath(100, 100, 86, 0, 270))!, []);
  const colors = t.arc.length > 1 ? t.arc : [t.arc[0], t.arc[0]];
  const step = niceStep(scale, 9);
  const labels = Array.from({length: Math.floor(scale / step) + 1}, (_, i) => i * step);
  // The needle is drawn pointing at 0° (3 o'clock) and turned to the speed.
  const turn = useDerivedValue(() => [{rotate: (angleOf(share.value) * Math.PI) / 180}]);
  // Small dials (the style picker) skip the numbers; they would be unreadable.
  const showLabels = size >= 120;

  return (
    <>
      <Canvas style={StyleSheet.absoluteFill}>
        <Group transform={[{scale: k}]}>
          <Circle cx={100} cy={100} r={97}>
            <LinearGradient start={vec(100, 3)} end={vec(100, 197)} colors={[t.faceInner ?? t.face, t.face]} />
          </Circle>
          <Circle cx={100} cy={100} r={97} style="stroke" strokeWidth={4} color={t.rim} />
          <Circle cx={100} cy={100} r={92} style="stroke" strokeWidth={1} color={t.rim} opacity={0.35} />
          {/* The arc in its colours along the scale: faint all the way, lit up to the speed. */}
          <Group transform={[{rotate: (GAUGE_START_DEG * Math.PI) / 180}]} origin={vec(100, 100)}>
            <Path path={arc} style="stroke" strokeWidth={6} opacity={0.18}>
              <SweepGradient c={vec(100, 100)} start={0} end={270} colors={colors} />
            </Path>
            <Path path={arc} start={0} end={share} style="stroke" strokeWidth={6}>
              <SweepGradient c={vec(100, 100)} start={0} end={270} colors={colors} />
            </Path>
          </Group>
          {/* Ticks: a long one at each label, short ones between. */}
          {Array.from({length: labels.length * 2 - 1}, (_, i) => {
            const major = i % 2 === 0;
            const a = GAUGE_START_DEG + (270 * i) / ((labels.length - 1) * 2);
            const outer = polar(100, 100, 80, a);
            const inner = polar(100, 100, major ? 71 : 75, a);
            return <Line key={i} p1={vec(inner.x, inner.y)} p2={vec(outer.x, outer.y)} color={t.tick} strokeWidth={major ? 1.6 : 1} strokeCap="round" />;
          })}
          {t.shiftLights ? Array.from({length: 7}, (_, i) => <ShiftLight key={i} i={i} share={share} />) : null}
          <Group transform={turn} origin={vec(100, 100)}>
            <Line p1={vec(88, 100)} p2={vec(174, 100)} color={t.needle} strokeWidth={2.6} strokeCap="round" />
          </Group>
          <Circle cx={100} cy={100} r={5} color={t.hub} />
        </Group>
      </Canvas>
      {showLabels
        ? labels.map((v) => {
            const p = polar(100, 100, 61, GAUGE_START_DEG + (270 * v) / scale);
            return (
              <Text key={v} style={[styles.label, {left: (p.x - 15) * k, top: (p.y - 5) * k, width: 30 * k, fontSize: 8.5 * k, color: t.number}]}>
                {v}
              </Text>
            );
          })
        : null}
      <Text style={[styles.unit, {top: 163 * k, fontSize: 8 * k, color: t.number}]}>{unit}</Text>
    </>
  );
}

const ROAD_MARKS = 7;
const HORIZON = 112;

/** How far (0 horizon … 1 at the viewer) the `k`th mark is, with the scene's phase. */
const depthOf = (k: number, phase: number) => {
  'worklet';
  return ((k + phase) / ROAD_MARKS) ** 2.2;
};
const yAt = (d: number) => {
  'worklet';
  return HORIZON + (200 - HORIZON) * d;
};

/** A lane dash rushing towards the viewer, longer and brighter as it gets close. */
function Dash({k, phase, color}: {k: number; phase: SharedValue<number>; color: string}) {
  const d = useDerivedValue(() => depthOf(k, phase.value));
  const p1 = useDerivedValue(() => ({x: 100, y: yAt(d.value)}));
  const p2 = useDerivedValue(() => ({x: 100, y: Math.min(200, yAt(d.value) + 2 + 16 * d.value)}));
  const width = useDerivedValue(() => 0.8 + 2.4 * d.value);
  const opacity = useDerivedValue(() => 0.35 + 0.65 * d.value);
  return <Line p1={p1} p2={p2} color={color} strokeWidth={width} opacity={opacity} strokeCap="round" />;
}

/** A pair of roadside posts, spreading out and growing as they pass. */
function Posts({k, phase, color}: {k: number; phase: SharedValue<number>; color: string}) {
  const d = useDerivedValue(() => depthOf(k + 0.5, phase.value));
  const leftX = useDerivedValue(() => 100 - (4 + 60 * d.value) - 4 * d.value);
  const rightX = useDerivedValue(() => 100 + (4 + 60 * d.value) + 4 * d.value);
  const l1 = useDerivedValue(() => ({x: leftX.value, y: yAt(d.value)}));
  const l2 = useDerivedValue(() => ({x: leftX.value, y: yAt(d.value) - (1 + 9 * d.value)}));
  const r1 = useDerivedValue(() => ({x: rightX.value, y: yAt(d.value)}));
  const r2 = useDerivedValue(() => ({x: rightX.value, y: yAt(d.value) - (1 + 9 * d.value)}));
  const width = useDerivedValue(() => 0.6 + 1.6 * d.value);
  const opacity = useDerivedValue(() => 0.25 + 0.6 * d.value);
  return (
    <Group opacity={opacity}>
      <Line p1={l1} p2={l2} color={color} strokeWidth={width} strokeCap="round" />
      <Line p1={r1} p2={r2} color={color} strokeWidth={width} strokeCap="round" />
    </Group>
  );
}

/** Road scenes: a sky over a road running to the horizon, the speed big at the top (Open, Daylight, Sunset). */
export function RoadFace({share, speed, size, t}: {share: SharedValue<number>; speed: number; size: number; t: RoadTheme}) {
  const k = size / 200;
  const reduce = useReduceMotion();
  // The marks keep rushing past while you drive (one mark per ~0.5 s at 60 km/h), on the UI thread.
  const pace = useSharedValue(0);
  const phase = useSharedValue(0);
  useEffect(() => {
    pace.set(reduce || speed <= 0.5 ? 0 : Math.min(speed, 200) * 0.035);
  }, [speed, reduce, pace]);
  useFrameCallback((frame) => {
    if (pace.value === 0) {
      return;
    }
    phase.set((phase.value + ((frame.timeSincePreviousFrame ?? 16) / 1000) * pace.value) % 1);
  });

  const paths = useMemo(() => {
    const clip = Skia.Path.Make();
    clip.addCircle(100, 100, 97);
    const road = Skia.Path.MakeFromSVGString('M96 112 L104 112 L150 200 L50 200 Z')!;
    const moon = Skia.Path.MakeFromSVGString('M150 38 a9 9 0 1 0 8 13 a7 7 0 1 1 -8 -13 Z')!;
    const rim = Skia.Path.MakeFromSVGString(arcPath(100, 100, 92, GAUGE_START_DEG, END_DEG))!;
    return {clip, road, moon, rim};
  }, []);

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Group transform={[{scale: k}]}>
        <Group clip={paths.clip}>
          <Rect x={0} y={0} width={200} height={HORIZON}>
            <LinearGradient start={vec(0, 0)} end={vec(0, HORIZON)} colors={t.sky} />
          </Rect>
          <Rect x={0} y={HORIZON} width={200} height={200 - HORIZON}>
            <LinearGradient start={vec(0, HORIZON)} end={vec(0, 200)} colors={t.ground} />
          </Rect>
          {t.light === 'moon' ? <Path path={paths.moon} color={GAUGE_INK.moon} /> : null}
          {t.light === 'sun' ? <Circle cx={152} cy={44} r={9} color={GAUGE_INK.sun} /> : null}
          {t.light === 'sunset' ? <Circle cx={100} cy={HORIZON} r={18} color={GAUGE_INK.sunset} opacity={0.85} /> : null}
          <Path path={paths.road} color={t.road} />
          <Line p1={vec(96, HORIZON)} p2={vec(50, 200)} color={t.line} strokeWidth={1.5} opacity={0.8} />
          <Line p1={vec(104, HORIZON)} p2={vec(150, 200)} color={t.line} strokeWidth={1.5} opacity={0.8} />
          {Array.from({length: ROAD_MARKS}, (_, i) => (
            <Dash key={`dash${i}`} k={i} phase={phase} color={t.line} />
          ))}
          {Array.from({length: ROAD_MARKS}, (_, i) => (
            <Posts key={`post${i}`} k={i} phase={phase} color={t.line} />
          ))}
        </Group>
        <Circle cx={100} cy={100} r={97} style="stroke" strokeWidth={3} color={GAUGE_INK.rim} opacity={0.18} />
        {/* How fast, as a thin bar along the rim. */}
        <Path path={paths.rim} style="stroke" strokeWidth={3} strokeCap="round" color={GAUGE_INK.rim} opacity={0.12} />
        <Path path={paths.rim} start={0} end={share} style="stroke" strokeWidth={3} strokeCap="round" color={GAUGE_INK.rim} />
      </Group>
    </Canvas>
  );
}

const styles = StyleSheet.create({
  label: {position: 'absolute', textAlign: 'center', fontWeight: '700', fontVariant: ['tabular-nums']},
  unit: {position: 'absolute', left: 0, right: 0, textAlign: 'center', fontWeight: '700', opacity: 0.7},
});
