import {useEffect} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Animated, {interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue} from 'react-native-reanimated';
import {useUnits} from '../../hooks/useUnits';
import {pressure} from '../../obd/tiles';
import {FONT} from '../../theme/theme';
import {CLUSTER_INK} from '../accents';
import {fraction} from '../motion';

/** Boost fills its bar at this much over the air outside. */
const BOOST_FULL_KPA = 120;

interface Reading {
  key: string;
  label: string;
  share: number;
  text: string;
}

function Bar({r, color, coast, vertical, length}: {r: Reading; color: string; coast: SharedValue<number>; vertical: boolean; length: number}) {
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.set(withSpring(r.share, {dampingRatio: 1, duration: 260}));
  }, [r.share, fill]);
  // Closed throttle turns the bars green, as on the arc meter.
  const style = useAnimatedStyle(() => {
    const c = interpolateColor(coast.value, [0, 1], [color, CLUSTER_INK.green]);
    return vertical ? {height: fill.value * length, backgroundColor: c, shadowColor: c} : {width: fill.value * length, backgroundColor: c, shadowColor: c};
  });
  if (vertical) {
    return (
      <View style={styles.column}>
        <Text style={styles.value}>{r.text}</Text>
        <View style={[styles.colTrack, {height: length}]}>
          <Animated.View style={[styles.colFill, style]} />
        </View>
        <Text style={styles.label}>{r.label}</Text>
      </View>
    );
  }
  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Text style={styles.label}>{r.label}</Text>
        <Text style={styles.value}>{r.text}</Text>
      </View>
      <View style={[styles.rowTrack, {width: length}]}>
        <Animated.View style={[styles.rowFill, style]} />
      </View>
    </View>
  );
}

/**
 * The Engine page's other views: engine load, throttle and boost as glowing bars, laid across
 * (`bars`) or standing up like an equaliser (`columns`).
 */
export function LoadBars({width, height, loadPct, throttlePct, boostKpa, coasting, accent, vertical}: {width: number; height: number; loadPct: number | null; throttlePct: number | null; boostKpa: number | null; coasting: boolean; accent: string; vertical: boolean}) {
  const u = useUnits();
  const coast = useSharedValue(0);
  useEffect(() => {
    coast.set(withTiming(coasting ? 1 : 0, {duration: 400}));
  }, [coasting, coast]);
  const readings: Reading[] = [
    {key: 'load', label: 'Load', share: coasting ? 0 : fraction(loadPct, 100), text: loadPct == null ? '–' : `${Math.round(coasting ? 0 : loadPct)}%`},
    {key: 'throttle', label: 'Throttle', share: fraction(throttlePct, 100), text: throttlePct == null ? '–' : `${Math.round(throttlePct)}%`},
  ];
  if (boostKpa != null) {
    const b = pressure(Math.max(0, boostKpa), u.units);
    readings.push({key: 'boost', label: 'Boost', share: fraction(Math.max(0, boostKpa), BOOST_FULL_KPA), text: `${b.value} ${b.unit}`});
  }
  const length = vertical ? Math.max(60, height - 110) : Math.max(120, width - 64);
  return (
    <View style={styles.page}>
      <Text style={styles.title}>{coasting ? 'COASTING · FUEL CUT' : 'ENGINE'}</Text>
      <View style={vertical ? styles.columns : styles.rows}>
        {readings.map((r) => (
          <Bar key={r.key} r={r} color={accent} coast={coast} vertical={vertical} length={length} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {flex: 1, paddingTop: 14, alignItems: 'center'},
  title: {color: CLUSTER_INK.textFaint, fontFamily: FONT.extrabold, fontSize: 11, letterSpacing: 2, marginBottom: 14},
  rows: {gap: 16},
  row: {gap: 6},
  rowHead: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline'},
  rowTrack: {height: 8, borderRadius: 4, backgroundColor: CLUSTER_INK.track},
  rowFill: {height: 8, borderRadius: 4, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: {width: 0, height: 0}},
  columns: {flexDirection: 'row', gap: 28, alignItems: 'flex-end'},
  column: {alignItems: 'center', gap: 8},
  colTrack: {width: 16, borderRadius: 8, backgroundColor: CLUSTER_INK.track, justifyContent: 'flex-end'},
  colFill: {width: 16, borderRadius: 8, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: {width: 0, height: 0}},
  label: {color: CLUSTER_INK.textDim, fontFamily: FONT.bold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase'},
  value: {color: CLUSTER_INK.text, fontFamily: FONT.black, fontSize: 18, fontVariant: ['tabular-nums']},
});
