import {Ionicons} from '@expo/vector-icons';
import {BlurMask, Canvas, Path, Skia} from '@shopify/react-native-skia';
import {useEffect, useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useSharedValue, withTiming} from 'react-native-reanimated';
import {FONT} from '../../theme/theme';
import {CLUSTER_INK} from '../accents';
import {polar} from '../motion';

/** How far outside the dial the arc runs, and how much of the dial's side it spans. */
const GAP = 7;
const SPAN = 70;
const PAD = 26;

/**
 * A thin curved gauge hugging the outside of a dial (coolant on the speed dial's left, fuel on the
 * RPM dial's right), filling from the bottom up with a glow, its icon at the foot and the reading
 * beside it. Tapping it changes how the strip gauges look.
 */
export function SideArc({
  size,
  left,
  top,
  side,
  share,
  color,
  icon,
  value,
  onPress,
}: {
  /** The dial's size and position; the arc is laid out around it. */
  size: number;
  left: number;
  top: number;
  side: 'left' | 'right';
  share: number | null;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string | null;
  onPress: () => void;
}) {
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.set(withTiming(share ?? 0, {duration: 600}));
  }, [share, fill]);

  const box = size + PAD * 2;
  const c = box / 2;
  const r = size / 2 + GAP;
  // Bottom to top: on the left that runs anticlockwise round 180°, on the right clockwise round 0°.
  const from = side === 'left' ? 180 + SPAN / 2 : SPAN / 2;
  const sweep = -SPAN;
  const path = useMemo(() => {
    const p = Skia.Path.Make();
    p.addArc({x: c - r, y: c - r, width: r * 2, height: r * 2}, from, sweep);
    return p;
  }, [c, r, from, sweep]);
  const foot = polar(c, c, r + 2, from + (side === 'left' ? 9 : -9));
  const head = polar(c, c, r, from + sweep);

  return (
    <>
      <View pointerEvents="none" style={[styles.box, {left: left - PAD, top: top - PAD, width: box, height: box}]}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Path path={path} style="stroke" strokeWidth={4} strokeCap="round" color={CLUSTER_INK.track} />
          <Path path={path} start={0} end={fill} style="stroke" strokeWidth={4} strokeCap="round" color={color} opacity={0.6}>
            <BlurMask blur={5} style="normal" />
          </Path>
          <Path path={path} start={0} end={fill} style="stroke" strokeWidth={4} strokeCap="round" color={color} />
        </Canvas>
        <View style={[styles.foot, {left: foot.x - 9, top: foot.y - 2}]}>
          <Ionicons name={icon} size={15} color={share == null ? CLUSTER_INK.textFaint : CLUSTER_INK.textDim} />
        </View>
        {value ? <Text style={[styles.value, {top: head.y - 22, left: side === 'left' ? head.x - 4 : head.x - 52, textAlign: side === 'left' ? 'left' : 'right'}]}>{value}</Text> : null}
      </View>
      {/* A strip along the arc to tap, so the dial inside keeps its swipe. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Change fuel and coolant gauge style"
        onPress={onPress}
        style={[styles.hit, {top: top + size * 0.2, height: size * 0.6, left: side === 'left' ? left - PAD : left + size - 10, width: PAD + 10}]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  box: {position: 'absolute'},
  foot: {position: 'absolute'},
  value: {position: 'absolute', width: 56, color: CLUSTER_INK.textDim, fontFamily: FONT.bold, fontSize: 11, fontVariant: ['tabular-nums']},
  hit: {position: 'absolute'},
});
