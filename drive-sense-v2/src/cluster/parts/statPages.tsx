import {Canvas, LinearGradient, Path, Skia, vec} from '@shopify/react-native-skia';
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

const styles = StyleSheet.create({
  legend: {flexDirection: 'row', gap: 16, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center'},
  key: {flexDirection: 'row', alignItems: 'center', gap: 6},
  swatch: {width: 10, height: 3, borderRadius: 2},
  keyText: {color: CLUSTER_INK.textDim, fontFamily: FONT.bold, fontSize: 11},
});
