import {Canvas, Line, LinearGradient, Path, Skia, vec} from '@shopify/react-native-skia';
import {useEffect, useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useCarStats} from '../../hooks/useCarStats';
import {useUnits} from '../../hooks/useUnits';
import {economy, economyLabel, fuelVolume} from '../../obd/tiles';
import {useHomeStore} from '../../stores/homeStore';
import {useObdStore, type HistoryPoint} from '../../stores/obdStore';
import {usePreferencesStore} from '../../stores/preferencesStore';
import {useActiveVehicle} from '../../stores/vehicleStore';
import {withAlpha} from '../../theme/color';
import {FONT} from '../../theme/theme';
import {formatDuration} from '../../utils/format';
import {kmhInUnits} from '../../utils/units';
import {CLUSTER_INK} from '../accents';
import {Figure, pageStyles} from './pages';

/** All-time driving totals over every recorded drive (the same figures as Home). */
export function DrivingTotalsPage() {
  const u = useUnits();
  const stats = useHomeStore((s) => s.stats);
  const load = useHomeStore((s) => s.load);
  // Home normally loads these; opened straight into the cluster, fetch them here.
  useEffect(() => {
    if (useHomeStore.getState().stats == null && !useHomeStore.getState().loading) {
      void load();
    }
  }, [load]);
  if (!stats?.trip_count) {
    return (
      <View style={pageStyles.page}>
        <Text style={pageStyles.title}>ALL TIME · DRIVING</Text>
        <Text style={pageStyles.hint}>No drives yet</Text>
      </View>
    );
  }
  return (
    <View style={pageStyles.page}>
      <Text style={pageStyles.title}>ALL TIME · DRIVING</Text>
      <View style={pageStyles.grid}>
        <Figure label="Distance" value={u.distance(stats.total_distance_meters)} unit={u.distanceUnit} />
        <Figure label="Drive time" value={formatDuration(stats.drive_time_seconds)} />
        <Figure label="Drives" value={String(stats.trip_count)} />
        <Figure label="Top speed" value={u.speed(stats.top_speed_mps)} unit={u.speedUnit} />
        <Figure label="Avg speed" value={u.speed(stats.avg_speed_mps)} unit={u.speedUnit} />
        <Figure label="Avg drive" value={u.distance(stats.avg_trip_distance_meters)} unit={u.distanceUnit} />
      </View>
    </View>
  );
}

/** All-time car figures for the active vehicle, from every drive the adapter has recorded. */
export function AllTimePage() {
  const u = useUnits();
  const mileage = usePreferencesStore((s) => s.mileageUnit);
  const vehicle = useActiveVehicle();
  const t = useCarStats({period: 'all', vehicleId: vehicle?.id ?? null});
  const label = economyLabel(u.units, mileage);
  if (!t || t.drives === 0) {
    return (
      <View style={pageStyles.page}>
        <Text style={pageStyles.title}>ALL TIME · CAR</Text>
        <Text style={pageStyles.hint}>Needs the adapter</Text>
      </View>
    );
  }
  const avg = t.avgL100km != null ? economy(t.avgL100km, u.units, mileage) : null;
  const best = t.bestL100km != null ? economy(t.bestL100km, u.units, mileage) : null;
  const fuel = t.fuelL != null ? fuelVolume(t.fuelL, u.units) : null;
  return (
    <View style={pageStyles.page}>
      <Text style={pageStyles.title}>ALL TIME · CAR</Text>
      <View style={pageStyles.grid}>
        <Figure label="Drives" value={String(t.drives)} />
        {avg ? <Figure label={`Avg ${label.toLowerCase()}`} value={avg.value} unit={avg.unit} /> : null}
        {best ? <Figure label="Best" value={best.value} unit={best.unit} /> : null}
        {fuel ? <Figure label="Fuel used" value={fuel.value} unit={fuel.unit} /> : null}
        {t.maxRpm != null ? <Figure label="Top RPM" value={Math.round(t.maxRpm).toLocaleString('en-US')} /> : null}
        {t.coastShare != null ? <Figure label="Coasting" value={String(Math.round(t.coastShare * 100))} unit="%" /> : null}
      </View>
    </View>
  );
}

/** A line (and optionally a soft fill under it) through the points, scaled into the box. */
const linePath = (points: {x: number; y: number}[], w: number, h: number, maxY: number, from: number, span: number, fill: boolean) => {
  const p = Skia.Path.Make();
  points.forEach((pt, i) => {
    const x = ((pt.x - from) / span) * w;
    const y = h - (Math.min(pt.y, maxY) / maxY) * (h - 4) - 2;
    if (i === 0) {
      p.moveTo(x, y);
    } else {
      p.lineTo(x, y);
    }
  });
  if (fill && points.length > 1) {
    p.lineTo(((points[points.length - 1].x - from) / span) * w, h);
    p.lineTo(((points[0].x - from) / span) * w, h);
    p.close();
  }
  return p;
};

const series = (history: HistoryPoint[], pick: (p: HistoryPoint) => number | null) =>
  history.flatMap((p) => {
    const y = pick(p);
    return y == null ? [] : [{x: p.at, y}];
  });

/** The last minute as a graph: speed filled in the accent, RPM as a thin white line over it. */
export function GraphPage({width, accent}: {width: number; accent: string}) {
  const u = useUnits();
  const history = useObdStore((s) => s.history);
  const w = Math.max(120, width - 48);
  const h = 120;
  const graph = useMemo(() => {
    const speed = series(history, (p) => (p.speed == null ? null : kmhInUnits(p.speed, u.units)));
    const rpm = series(history, (p) => p.rpm);
    if (speed.length < 2 && rpm.length < 2) {
      return null;
    }
    const from = history[0].at;
    const span = Math.max(1, history[history.length - 1].at - from);
    const topSpeed = Math.max(...speed.map((p) => p.y), 0);
    const topRpm = Math.max(...rpm.map((p) => p.y), 0);
    const speedMax = Math.max(60, Math.ceil(topSpeed / 20) * 20);
    const rpmMax = Math.max(3000, Math.ceil(topRpm / 1000) * 1000);
    return {
      speedFill: linePath(speed, w, h, speedMax, from, span, true),
      speedLine: linePath(speed, w, h, speedMax, from, span, false),
      rpmLine: linePath(rpm, w, h, rpmMax, from, span, false),
      topSpeed: Math.round(topSpeed),
      topRpm: Math.round(topRpm),
    };
  }, [history, u.units, w]);

  return (
    <View style={pageStyles.page}>
      <Text style={pageStyles.title}>LAST MINUTE</Text>
      {graph ? (
        <>
          <Canvas style={{width: w, height: h}}>
            <Path path={graph.speedFill}>
              <LinearGradient start={vec(0, 0)} end={vec(0, h)} colors={[withAlpha(accent, 0.45), withAlpha(CLUSTER_INK.background, 0)]} />
            </Path>
            <Path path={graph.speedLine} style="stroke" strokeWidth={2.4} strokeJoin="round" color={accent} />
            <Path path={graph.rpmLine} style="stroke" strokeWidth={1.4} strokeJoin="round" color={CLUSTER_INK.textDim} />
          </Canvas>
          <View style={styles.legend}>
            <View style={styles.key}>
              <View style={[styles.swatch, {backgroundColor: accent}]} />
              <Text style={styles.keyText}>
                Speed · top {graph.topSpeed} {u.speedUnit}
              </Text>
            </View>
            <View style={styles.key}>
              <View style={[styles.swatch, {backgroundColor: CLUSTER_INK.textDim}]} />
              <Text style={styles.keyText}>RPM · top {graph.topRpm.toLocaleString('en-US')}</Text>
            </View>
          </View>
        </>
      ) : (
        <Text style={pageStyles.hint}>Drive to fill the graph</Text>
      )}
    </View>
  );
}

/**
 * One minute of one engine value, as wide as the Speed graph and styled like it: the figure big on
 * top, faint grid lines, the area fading down under a glowing line, and the minute's average and top
 * below. Cars that report torque get POWER and TORQUE in the Engine page's views.
 */
export function EngineGraphPage({
  title,
  value,
  unit,
  format,
  pick,
  step,
  width,
  color,
}: {
  title: string;
  value: string;
  unit: string;
  /** A reading as text in the shown unit (the avg and top below the graph). */
  format: (n: number) => string;
  pick: (p: HistoryPoint) => number | null;
  /** The scale rounds its top up to a multiple of this. */
  step: number;
  /** The centre panel's width; the graph spans it like the Speed graph (GraphPage). */
  width: number;
  color: string;
}) {
  const history = useObdStore((s) => s.history);
  const w = Math.max(120, width - 48);
  const h = 84;
  const graph = useMemo(() => {
    const points = series(history, pick);
    if (points.length < 2) {
      return null;
    }
    const from = history[0].at;
    const span = Math.max(1, history[history.length - 1].at - from);
    const top = Math.max(...points.map((p) => p.y), 0);
    const avg = points.reduce((a, p) => a + p.y, 0) / points.length;
    const max = Math.max(step, Math.ceil(top / step) * step);
    return {fill: linePath(points, w, h, max, from, span, true), line: linePath(points, w, h, max, from, span, false), top, avg};
  }, [history, pick, step, w]);

  return (
    <View style={pageStyles.page}>
      <Text style={pageStyles.title}>{title} · LAST MINUTE</Text>
      <Figure label={title} value={value} unit={unit} big />
      <Canvas style={{width: w, height: h, marginTop: 8}}>
        {[0, 0.5, 1].map((f) => (
          <Line key={f} p1={vec(0, h * f)} p2={vec(w, h * f)} color={CLUSTER_INK.track} strokeWidth={1} />
        ))}
        {graph ? (
          <>
            <Path path={graph.fill}>
              <LinearGradient start={vec(0, 0)} end={vec(0, h)} colors={[withAlpha(color, 0.5), withAlpha(color, 0)]} />
            </Path>
            <Path path={graph.line} style="stroke" strokeWidth={6} strokeJoin="round" color={color} opacity={0.25} />
            <Path path={graph.line} style="stroke" strokeWidth={2.4} strokeJoin="round" color={color} />
          </>
        ) : null}
      </Canvas>
      <View style={styles.foot}>
        <Text style={styles.stat}>
          avg <Text style={styles.statValue}>{graph ? format(graph.avg) : '–'}</Text>
        </Text>
        <Text style={styles.stat}>
          top <Text style={styles.statValue}>{graph ? format(graph.top) : '–'}</Text>
        </Text>
      </View>
    </View>
  );
}

/** One of the two lines on the combined graph, with its own scale (the units differ). */
interface DualLine {
  label: string;
  value: string;
  unit: string;
  pick: (p: HistoryPoint) => number | null;
  step: number;
  color: string;
}

/**
 * Power and torque together: both figures on top, both lines over the last minute, each scaled to
 * its own peak so the shapes line up (torque leads, power follows the revs).
 */
export function DualGraphPage({title, first, second, width}: {title: string; first: DualLine; second: DualLine; width: number}) {
  const history = useObdStore((s) => s.history);
  const w = Math.max(120, width - 48);
  const h = 84;
  const graph = useMemo(() => {
    if (history.length < 2) {
      return null;
    }
    const from = history[0].at;
    const span = Math.max(1, history[history.length - 1].at - from);
    const draw = (l: DualLine) => {
      const points = series(history, l.pick);
      if (points.length < 2) {
        return null;
      }
      const top = Math.max(...points.map((p) => p.y), 0);
      return linePath(points, w, h, Math.max(l.step, Math.ceil(top / l.step) * l.step), from, span, false);
    };
    const firstPoints = series(history, first.pick);
    const firstTop = Math.max(...firstPoints.map((p) => p.y), 0);
    const firstMax = Math.max(first.step, Math.ceil(firstTop / first.step) * first.step);
    return {
      fill: firstPoints.length < 2 ? null : linePath(firstPoints, w, h, firstMax, from, span, true),
      first: draw(first),
      second: draw(second),
    };
    // The lines' looks, not their figures: those change every reading and need no new paths.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, first.pick, first.step, first.color, second.pick, second.step, second.color, w]);

  return (
    <View style={pageStyles.page}>
      <Text style={pageStyles.title}>{title}</Text>
      <View style={pageStyles.grid}>
        <Figure label={first.label} value={first.value} unit={first.unit} big />
        <Figure label={second.label} value={second.value} unit={second.unit} big />
      </View>
      {graph && (graph.first || graph.second) ? (
        <>
          <Canvas style={{width: w, height: h, marginTop: 8}}>
            {[0, 0.5, 1].map((f) => (
              <Line key={f} p1={vec(0, h * f)} p2={vec(w, h * f)} color={CLUSTER_INK.track} strokeWidth={1} />
            ))}
            {graph.fill ? (
              <Path path={graph.fill}>
                <LinearGradient start={vec(0, 0)} end={vec(0, h)} colors={[withAlpha(first.color, 0.45), withAlpha(first.color, 0)]} />
              </Path>
            ) : null}
            {graph.first ? <Path path={graph.first} style="stroke" strokeWidth={6} strokeJoin="round" color={first.color} opacity={0.25} /> : null}
            {graph.first ? <Path path={graph.first} style="stroke" strokeWidth={2.4} strokeJoin="round" color={first.color} /> : null}
            {graph.second ? <Path path={graph.second} style="stroke" strokeWidth={1.8} strokeJoin="round" color={second.color} /> : null}
          </Canvas>
          <View style={styles.legend}>
            {[first, second].map((l) => (
              <View key={l.label} style={styles.key}>
                <View style={[styles.swatch, {backgroundColor: l.color}]} />
                <Text style={styles.keyText}>{l.label}</Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <Text style={pageStyles.hint}>Drive to fill the graph</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {flexDirection: 'row', gap: 16, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center'},
  key: {flexDirection: 'row', alignItems: 'center', gap: 6},
  swatch: {width: 10, height: 3, borderRadius: 2},
  keyText: {color: CLUSTER_INK.textDim, fontFamily: FONT.bold, fontSize: 11},
  foot: {flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 8},
  stat: {color: CLUSTER_INK.textDim, fontFamily: FONT.bold, fontSize: 12},
  statValue: {color: CLUSTER_INK.text, fontFamily: FONT.black, fontSize: 14, fontVariant: ['tabular-nums']},
});
