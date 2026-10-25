import {Ionicons} from '@expo/vector-icons';
import {useEffect} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Animated, {useAnimatedStyle, useSharedValue, withTiming} from 'react-native-reanimated';
import {FONT} from '../../theme/theme';
import {CLUSTER_INK} from '../accents';

/** A short bar gauge for the bottom strip (coolant, fuel): icon, segmented track, fill that eases. */
export function BarGauge({
  icon,
  share,
  color,
  caption,
  align = 'left',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  /** 0–1, or null when unknown. */
  share: number | null;
  color: string;
  caption: string | null;
  align?: 'left' | 'right';
}) {
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.set(withTiming(share ?? 0, {duration: 600}));
  }, [share, fill]);
  const style = useAnimatedStyle(() => ({width: `${fill.value * 100}%`}));
  return (
    <View style={[styles.row, align === 'right' && {flexDirection: 'row-reverse'}]}>
      <Ionicons name={icon} size={15} color={share == null ? CLUSTER_INK.textFaint : CLUSTER_INK.textDim} />
      <View style={styles.track}>
        <Animated.View style={[styles.fill, {backgroundColor: color, shadowColor: color}, align === 'right' && {alignSelf: 'flex-end'}, style]} />
        {[0.25, 0.5, 0.75].map((m) => (
          <View key={m} style={[styles.notch, {left: `${m * 100}%`}]} />
        ))}
      </View>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', gap: 8},
  track: {width: 110, height: 5, borderRadius: 3, backgroundColor: CLUSTER_INK.track, overflow: 'hidden'},
  fill: {height: 5, borderRadius: 3, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: {width: 0, height: 0}},
  notch: {position: 'absolute', top: 0, width: 1, height: 5, backgroundColor: CLUSTER_INK.background},
  caption: {color: CLUSTER_INK.textDim, fontFamily: FONT.bold, fontSize: 12, fontVariant: ['tabular-nums']},
});
