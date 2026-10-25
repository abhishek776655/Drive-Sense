import {BlurMask, Canvas, Circle, Group, Line, RadialGradient, vec} from '@shopify/react-native-skia';
import {useEffect} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useDerivedValue, useSharedValue, withSpring, withTiming} from 'react-native-reanimated';
import {FONT} from '../../theme/theme';
import {CLUSTER_INK} from '../accents';
import {gPoint} from '../motion';

const MAX_G = 1;

/**
 * Phone-only stand-in for the RPM dial (spec 2026-10-25, cluster mode, section 3): a dot that moves
 * with the car's G (speeding up toward the top, braking toward the bottom, turns sideways), rings at
 * 0.25/0.5/0.75 g, and the drive's peak as a fading ghost.
 */
export function GDial({size, g, accent}: {size: number; g: {lon: number; lat: number} | null; accent: string}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 22;
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const peakX = useSharedValue(0);
  const peakY = useSharedValue(0);
  const peakOpacity = useSharedValue(0);

  useEffect(() => {
    const p = g ? gPoint(g, r, MAX_G) : {x: 0, y: 0};
    x.set(withSpring(p.x, {dampingRatio: 1, duration: 250}));
    y.set(withSpring(p.y, {dampingRatio: 1, duration: 250}));
    if (Math.hypot(p.x, p.y) > Math.hypot(peakX.value, peakY.value)) {
      peakX.set(p.x);
      peakY.set(p.y);
      peakOpacity.set(0.55);
      peakOpacity.set(withTiming(0.12, {duration: 4000}));
    }
  }, [g, r, x, y, peakX, peakY, peakOpacity]);

  const dotX = useDerivedValue(() => cx + x.value);
  const dotY = useDerivedValue(() => cy + y.value);
  const ghostX = useDerivedValue(() => cx + peakX.value);
  const ghostY = useDerivedValue(() => cy + peakY.value);
  const total = g ? Math.hypot(g.lon, g.lat) : 0;

  return (
    <View style={{width: size, height: size}}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Circle cx={cx} cy={cy} r={r + 12}>
          <RadialGradient c={vec(cx, cy)} r={r * 1.2} colors={[CLUSTER_INK.faceEdge, CLUSTER_INK.face, '#000000']} positions={[0, 0.7, 1]} />
        </Circle>
        {[0.25, 0.5, 0.75, 1].map((ring) => (
          <Circle key={ring} cx={cx} cy={cy} r={r * ring} style="stroke" strokeWidth={ring === 1 ? 1.5 : 1} color={ring === 1 ? 'rgba(255,255,255,0.16)' : CLUSTER_INK.track} />
        ))}
        <Line p1={vec(cx - r, cy)} p2={vec(cx + r, cy)} color={CLUSTER_INK.track} strokeWidth={1} />
        <Line p1={vec(cx, cy - r)} p2={vec(cx, cy + r)} color={CLUSTER_INK.track} strokeWidth={1} />
        <Group opacity={peakOpacity}>
          <Circle cx={ghostX} cy={ghostY} r={6} color={accent} />
        </Group>
        <Circle cx={dotX} cy={dotY} r={16} color={accent} opacity={0.5}>
          <BlurMask blur={10} style="normal" />
        </Circle>
        <Circle cx={dotX} cy={dotY} r={7} color={accent} />
        <Circle cx={dotX} cy={dotY} r={2.5} color="#FFFFFF" />
      </Canvas>
      <View style={[StyleSheet.absoluteFill, styles.centre]} pointerEvents="none">
        <Text style={[styles.number, {marginTop: size * 0.42}]}>{total.toFixed(2)}</Text>
        <Text style={styles.unit}>G</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: {alignItems: 'center'},
  number: {color: CLUSTER_INK.text, fontFamily: FONT.black, fontSize: 22, fontVariant: ['tabular-nums']},
  unit: {color: CLUSTER_INK.textDim, fontFamily: FONT.bold, fontSize: 12, letterSpacing: 1},
});
