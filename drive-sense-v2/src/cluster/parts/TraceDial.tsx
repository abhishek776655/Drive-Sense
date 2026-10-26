import {Canvas, Group, Line, LinearGradient, Path, Skia, vec} from '@shopify/react-native-skia';
import {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {withAlpha} from '../../theme/color';
import {FONT} from '../../theme/theme';
import {HISTORY_MS} from '../../stores/obdStore';
import {CLUSTER_INK} from '../accents';
import {DialFace} from './DialFace';

/** One line on the dial's graph, scaled on its own (power and torque share a graph, not a unit). */
export interface TraceLine {
  points: {at: number; v: number}[];
  color: string;
  /** The main line gets the glow and the fill; others are a thin line over it. */
  main?: boolean;
}

/**
 * A dial face holding the last minute of engine values as a glowing graph (Power, Fuel): a caption
 * and the big figure above it, a row of small figures below. Laid out like the Speed dial.
 */
export function TraceDial({
  size,
  caption,
  value,
  unit,
  lines,
  foot,
}: {
  size: number;
  caption: string;
  value: string;
  unit: string;
  lines: TraceLine[];
  foot: {label: string; value: string}[];
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 22;
  // The graph's box: the face's widest band, below the middle.
  const left = cx - r * 0.78;
  const w = r * 1.56;
  const top = cy - r * 0.12;
  const h = r * 0.62;

  const paths = useMemo(() => {
    const end = Math.max(0, ...lines.flatMap((l) => l.points.map((p) => p.at)));
    return lines.flatMap((l) => {
      if (l.points.length < 2) {
        return [];
      }
      const peak = Math.max(...l.points.map((p) => p.v), 0);
      // Round the top of the scale up so the line doesn't ride the top edge.
      const scale = peak > 0 ? peak * 1.15 : 1;
      const x = (at: number) => left + (1 - (end - at) / HISTORY_MS) * w;
      const y = (v: number) => top + h - (Math.max(0, v) / scale) * h;
      const line = Skia.Path.Make();
      l.points.forEach((p, i) => (i === 0 ? line.moveTo(x(p.at), y(p.v)) : line.lineTo(x(p.at), y(p.v))));
      const area = line.copy();
      area.lineTo(x(l.points[l.points.length - 1].at), top + h);
      area.lineTo(x(l.points[0].at), top + h);
      area.close();
      return [{line, area, color: l.color, main: l.main ?? false}];
    });
  }, [lines, left, w, top, h]);

  return (
    <View style={{width: size, height: size}}>
      <Canvas style={StyleSheet.absoluteFill}>
        <DialFace cx={cx} cy={cy} r={r} />
        {[0, 0.5, 1].map((f) => (
          <Line key={f} p1={vec(left, top + h * f)} p2={vec(left + w, top + h * f)} color={CLUSTER_INK.track} strokeWidth={1} />
        ))}
        {paths.map((p, i) =>
          p.main ? (
            <Group key={i}>
              <Path path={p.area}>
                <LinearGradient start={vec(0, top)} end={vec(0, top + h)} colors={[withAlpha(p.color, 0.5), withAlpha(p.color, 0)]} />
              </Path>
              <Path path={p.line} style="stroke" strokeWidth={6} strokeJoin="round" color={p.color} opacity={0.25} />
              <Path path={p.line} style="stroke" strokeWidth={2.4} strokeJoin="round" color={p.color} />
            </Group>
          ) : (
            <Path key={i} path={p.line} style="stroke" strokeWidth={1.6} strokeJoin="round" color={p.color} />
          ),
        )}
      </Canvas>
      <View style={[styles.head, {top: cy - r * 0.7}]} pointerEvents="none">
        <Text style={styles.caption}>{caption}</Text>
        <Text style={[styles.number, {fontSize: size * 0.12}]}>{value}</Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>
      <View style={[styles.foot, {top: top + h + 10}]} pointerEvents="none">
        {foot.map((f) => (
          <Text key={f.label} style={styles.stat}>
            {f.label} <Text style={styles.statValue}>{f.value}</Text>
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {position: 'absolute', left: 0, right: 0, alignItems: 'center'},
  caption: {color: CLUSTER_INK.textFaint, fontFamily: FONT.extrabold, fontSize: 10, letterSpacing: 2},
  number: {color: CLUSTER_INK.text, fontFamily: FONT.black, fontVariant: ['tabular-nums'], letterSpacing: -1},
  unit: {color: CLUSTER_INK.textDim, fontFamily: FONT.bold, fontSize: 11, letterSpacing: 1, marginTop: -4},
  foot: {position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 18},
  stat: {color: CLUSTER_INK.textDim, fontFamily: FONT.bold, fontSize: 12},
  statValue: {color: CLUSTER_INK.text, fontFamily: FONT.black, fontSize: 14, fontVariant: ['tabular-nums']},
});
