import {Ionicons} from '@expo/vector-icons';
import {BlurMask, Canvas, Circle, Group, Line, Path, Skia, vec} from '@shopify/react-native-skia';
import {useEffect, useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useDerivedValue, useSharedValue, withSpring} from 'react-native-reanimated';
import {usePreferencesStore} from '../../stores/preferencesStore';
import {FONT} from '../../theme/theme';
import {CLUSTER_INK} from '../accents';
import {angleAt, arcPath, polar} from '../motion';
import {DialFace} from './DialFace';

/** The meter reads ±15 % over the top of the dial. */
const MAX_GRADE = 15;
const START = 210;
const SWEEP = 120;
const FT_PER_M = 3.28084;

/** -15…+15 % as 0…1 along the meter. */
const share = (grade: number) => {
  'worklet';
  return (Math.max(-MAX_GRADE, Math.min(MAX_GRADE, grade)) + MAX_GRADE) / (MAX_GRADE * 2);
};

/**
 * Climb (phone dial): an inclinometer over the top reading the road's gradient, a horizon line in
 * the middle tilting with it, and the altitude big in the centre.
 */
export function ClimbDial({size, accent, altitudeM, gradePct}: {size: number; accent: string; altitudeM: number | null; gradePct: number | null}) {
  const units = usePreferencesStore((s) => s.units);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 22;
  const meterR = r - 10;
  const meter = useMemo(() => Skia.Path.MakeFromSVGString(arcPath(cx, cy, meterR, 0, 1, START, SWEEP))!, [cx, cy, meterR]);
  const zero = share(0);

  const g = useSharedValue(0);
  useEffect(() => {
    g.set(withSpring(gradePct ?? 0, {dampingRatio: 1, duration: 500}));
  }, [gradePct, g]);
  const lit = useDerivedValue(() => share(g.value));
  const from = useDerivedValue(() => Math.min(zero, lit.value));
  const to = useDerivedValue(() => Math.max(zero, lit.value));
  const tip = useDerivedValue(() => polar(cx, cy, meterR, angleAt(lit.value, START, SWEEP)));
  const tipX = useDerivedValue(() => tip.value.x);
  const tipY = useDerivedValue(() => tip.value.y);
  // The horizon tilts with the slope (exaggerated ×3 so a 5 % hill reads at a glance).
  const tilt = useDerivedValue(() => [{rotate: -Math.atan((g.value * 3) / 100)}]);

  const ticks = [-15, -10, -5, 0, 5, 10, 15];
  const alt = altitudeM == null ? null : Math.round(units === 'imperial' ? altitudeM * FT_PER_M : altitudeM);
  const grade = gradePct == null ? null : Math.round(gradePct * 10) / 10;

  return (
    <View style={{width: size, height: size}}>
      <Canvas style={StyleSheet.absoluteFill}>
        <DialFace cx={cx} cy={cy} r={r} />
        <Path path={meter} style="stroke" strokeWidth={8} strokeCap="round" color={CLUSTER_INK.track} />
        <Path path={meter} start={from} end={to} style="stroke" strokeWidth={8} strokeCap="round" color={accent} opacity={0.5}>
          <BlurMask blur={6} style="normal" />
        </Path>
        <Path path={meter} start={from} end={to} style="stroke" strokeWidth={8} strokeCap="round" color={accent} />
        {ticks.map((t) => {
          const deg = angleAt(share(t), START, SWEEP);
          const a = polar(cx, cy, meterR - 10, deg);
          const b = polar(cx, cy, meterR - (t % 10 === 0 ? 20 : 15), deg);
          return <Line key={t} p1={vec(a.x, a.y)} p2={vec(b.x, b.y)} color={t === 0 ? CLUSTER_INK.text : CLUSTER_INK.tick} strokeWidth={t % 10 === 0 ? 2 : 1} strokeCap="round" />;
        })}
        {/* The pointer: a bright dot riding the meter at the current gradient. */}
        <Circle cx={tipX} cy={tipY} r={9} color={accent} opacity={0.55}>
          <BlurMask blur={7} style="normal" />
        </Circle>
        <Circle cx={tipX} cy={tipY} r={4} color="#FFFFFF" />
        {/* Horizon: a level line through the middle, tipping with the road. */}
        <Group transform={tilt} origin={vec(cx, cy + r * 0.38)}>
          <Line p1={vec(cx - r * 0.5, cy + r * 0.38)} p2={vec(cx + r * 0.5, cy + r * 0.38)} color={accent} strokeWidth={2.5} strokeCap="round" />
          <Line p1={vec(cx - r * 0.5, cy + r * 0.38)} p2={vec(cx + r * 0.5, cy + r * 0.38)} color={accent} strokeWidth={8} strokeCap="round" opacity={0.3}>
            <BlurMask blur={6} style="normal" />
          </Line>
        </Group>
      </Canvas>
      {[-10, 0, 10].map((t) => {
        const p = polar(cx, cy, meterR - 34, angleAt(share(t), START, SWEEP));
        return (
          <Text key={t} style={[styles.tick, {left: p.x - 20, top: p.y - 8}]}>
            {t > 0 ? `+${t}` : t}
          </Text>
        );
      })}
      <View style={[StyleSheet.absoluteFill, styles.centre]} pointerEvents="none">
        <Text style={[styles.number, {fontSize: size * 0.17}]}>{alt ?? '–'}</Text>
        <Text style={styles.unit}>{units === 'imperial' ? 'ft' : 'm'} altitude</Text>
        <View style={styles.gradeRow}>
          <Ionicons name={grade != null && grade < 0 ? 'trending-down' : 'trending-up'} size={15} color={grade == null ? CLUSTER_INK.textFaint : accent} />
          <Text style={styles.grade}>{grade == null ? '–' : `${grade > 0 ? '+' : ''}${grade.toFixed(1)}%`}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: {alignItems: 'center', justifyContent: 'center'},
  tick: {position: 'absolute', width: 40, textAlign: 'center', color: CLUSTER_INK.textDim, fontFamily: FONT.bold, fontSize: 11, fontVariant: ['tabular-nums']},
  number: {color: CLUSTER_INK.text, fontFamily: FONT.black, fontVariant: ['tabular-nums'], letterSpacing: -1},
  unit: {color: CLUSTER_INK.textDim, fontFamily: FONT.bold, fontSize: 12, letterSpacing: 1, marginTop: -2},
  gradeRow: {flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10},
  grade: {color: CLUSTER_INK.text, fontFamily: FONT.extrabold, fontSize: 16, fontVariant: ['tabular-nums']},
});
