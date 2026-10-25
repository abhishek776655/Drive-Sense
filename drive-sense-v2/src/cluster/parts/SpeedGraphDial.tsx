import {Canvas, Group, Line, LinearGradient, Path, Skia, vec} from '@shopify/react-native-skia';
import {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useUnits} from '../../hooks/useUnits';
import {withAlpha} from '../../theme/color';
import {FONT} from '../../theme/theme';
import {kmhInUnits} from '../../utils/units';
import {CLUSTER_INK} from '../accents';
import {SPEED_TRACE_MS} from '../usePhoneTrace';
import {DialFace} from './DialFace';

/**
 * Speed (phone dial): the last two minutes of GPS speed as a glowing area graph inside the face,
 * the current speed above it and the period's average and top below.
 */
export function SpeedGraphDial({size, accent, trace}: {size: number; accent: string; trace: {at: number; kmh: number}[]}) {
  const u = useUnits();
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 22;
  // The graph's box: the face's widest band, below the middle.
  const left = cx - r * 0.78;
  const w = r * 1.56;
  const top = cy - r * 0.12;
  const h = r * 0.62;

  const graph = useMemo(() => {
    if (trace.length < 2) {
      return null;
    }
    const values = trace.map((p) => kmhInUnits(p.kmh, u.units));
    const end = trace[trace.length - 1].at;
    const peak = Math.max(...values, 1);
    const scale = Math.max(40, Math.ceil(peak / 20) * 20);
    const x = (at: number) => left + (1 - (end - at) / SPEED_TRACE_MS) * w;
    const y = (v: number) => top + h - (v / scale) * h;
    const line = Skia.Path.Make();
    trace.forEach((p, i) => (i === 0 ? line.moveTo(x(p.at), y(values[i])) : line.lineTo(x(p.at), y(values[i]))));
    const area = line.copy();
    area.lineTo(x(end), top + h);
    area.lineTo(x(trace[0].at), top + h);
    area.close();
    return {line, area, avg: values.reduce((a, v) => a + v, 0) / values.length, top: peak, now: values[values.length - 1], scale};
  }, [trace, u.units, left, w, top, h]);

  return (
    <View style={{width: size, height: size}}>
      <Canvas style={StyleSheet.absoluteFill}>
        <DialFace cx={cx} cy={cy} r={r} />
        {[0, 0.5, 1].map((f) => (
          <Line key={f} p1={vec(left, top + h * f)} p2={vec(left + w, top + h * f)} color={CLUSTER_INK.track} strokeWidth={1} />
        ))}
        {graph ? (
          <Group>
            <Path path={graph.area}>
              <LinearGradient start={vec(0, top)} end={vec(0, top + h)} colors={[withAlpha(accent, 0.5), withAlpha(accent, 0)]} />
            </Path>
            <Path path={graph.line} style="stroke" strokeWidth={6} strokeJoin="round" color={accent} opacity={0.25} />
            <Path path={graph.line} style="stroke" strokeWidth={2.4} strokeJoin="round" color={accent} />
          </Group>
        ) : null}
      </Canvas>
      <View style={[styles.head, {top: cy - r * 0.7}]} pointerEvents="none">
        <Text style={styles.caption}>LAST 2 MIN</Text>
        <Text style={[styles.number, {fontSize: size * 0.12}]}>{graph ? Math.round(graph.now) : '–'}</Text>
        <Text style={styles.unit}>{u.speedUnit}</Text>
      </View>
      <View style={[styles.foot, {top: top + h + 10}]} pointerEvents="none">
        <Text style={styles.stat}>
          avg <Text style={styles.statValue}>{graph ? Math.round(graph.avg) : '–'}</Text>
        </Text>
        <Text style={styles.stat}>
          top <Text style={styles.statValue}>{graph ? Math.round(graph.top) : '–'}</Text>
        </Text>
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
