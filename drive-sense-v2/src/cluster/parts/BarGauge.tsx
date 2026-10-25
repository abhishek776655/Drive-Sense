import {Ionicons} from '@expo/vector-icons';
import {BlurMask, Canvas, Path, Skia} from '@shopify/react-native-skia';
import {useEffect, useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Animated, {useAnimatedStyle, useSharedValue, withTiming, type SharedValue} from 'react-native-reanimated';
import {FONT} from '../../theme/theme';
import {CLUSTER_INK, type GaugeStyle} from '../accents';

const RING = 30;

/** A small ring that fills clockwise from the top, glowing in the gauge colour. */
function Ring({fill, color}: {fill: SharedValue<number>; color: string}) {
  const path = useMemo(() => {
    const p = Skia.Path.Make();
    p.addArc({x: 3, y: 3, width: RING - 6, height: RING - 6}, -90, 359.9);
    return p;
  }, []);
  return (
    <Canvas style={{width: RING, height: RING}}>
      <Path path={path} style="stroke" strokeWidth={3} color={CLUSTER_INK.track} />
      <Path path={path} start={0} end={fill} style="stroke" strokeWidth={3} strokeCap="round" color={color} opacity={0.6}>
        <BlurMask blur={3} style="normal" />
      </Path>
      <Path path={path} start={0} end={fill} style="stroke" strokeWidth={3} strokeCap="round" color={color} />
    </Canvas>
  );
}

/**
 * A strip gauge (coolant, fuel) in one of three looks: a segmented bar, a small ring with the
 * figure beside it, or just the figure. The fill eases between readings.
 */
export function BarGauge({
  icon,
  share,
  color,
  caption,
  value,
  variant = 'bar',
  align = 'left',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  /** 0–1, or null when unknown. */
  share: number | null;
  color: string;
  caption: string | null;
  /** The reading as text ("61%", "90°C"), shown by the ring and digits looks. */
  value: string | null;
  variant?: GaugeStyle;
  align?: 'left' | 'right';
}) {
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.set(withTiming(share ?? 0, {duration: 600}));
  }, [share, fill]);
  const style = useAnimatedStyle(() => ({width: `${fill.value * 100}%`}));
  const iconColor = share == null ? CLUSTER_INK.textFaint : CLUSTER_INK.textDim;
  return (
    <View style={[styles.row, align === 'right' && {flexDirection: 'row-reverse'}]}>
      <Ionicons name={icon} size={15} color={variant === 'digits' ? color : iconColor} />
      {variant === 'bar' ? (
        <View style={styles.track}>
          <Animated.View style={[styles.fill, {backgroundColor: color, shadowColor: color}, align === 'right' && {alignSelf: 'flex-end'}, style]} />
          {[0.25, 0.5, 0.75].map((m) => (
            <View key={m} style={[styles.notch, {left: `${m * 100}%`}]} />
          ))}
        </View>
      ) : variant === 'ring' ? (
        <Ring fill={fill} color={color} />
      ) : null}
      {variant !== 'bar' && value ? <Text style={[styles.value, variant === 'digits' && styles.digits]}>{value}</Text> : null}
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', gap: 8},
  track: {width: 110, height: 5, borderRadius: 3, backgroundColor: CLUSTER_INK.track, overflow: 'hidden'},
  fill: {height: 5, borderRadius: 3, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: {width: 0, height: 0}},
  notch: {position: 'absolute', top: 0, width: 1, height: 5, backgroundColor: CLUSTER_INK.background},
  value: {color: CLUSTER_INK.text, fontFamily: FONT.extrabold, fontSize: 13, fontVariant: ['tabular-nums']},
  digits: {fontSize: 17, fontFamily: FONT.black},
  caption: {color: CLUSTER_INK.textDim, fontFamily: FONT.bold, fontSize: 12, fontVariant: ['tabular-nums']},
});
