import {StyleSheet, Text, View} from 'react-native';
import {useUnits} from '../../hooks/useUnits';
import {formatMoney} from '../../obd/fuel';
import {economy, economyLabel, fuelVolume, pressure, temperature} from '../../obd/tiles';
import {usePreferencesStore} from '../../stores/preferencesStore';
import {FONT} from '../../theme/theme';
import {formatClock} from '../../utils/format';
import {CLUSTER_INK} from '../accents';
import type {ClusterData} from '../clusterData';

/** One figure on a page: small caps label, value, unit. */
export function Figure({label, value, unit, big}: {label: string; value: string; unit?: string; big?: boolean}) {
  return (
    <View style={pageStyles.figure}>
      <Text style={pageStyles.label}>{label}</Text>
      <View style={pageStyles.valueRow}>
        <Text style={[pageStyles.value, big && pageStyles.big]}>{value}</Text>
        {unit ? <Text style={pageStyles.unit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

/** The Trip page: this drive so far, or what the car is doing when nothing is recording. */
export function TripPage({d}: {d: ClusterData}) {
  const u = useUnits();
  const mileage = usePreferencesStore((s) => s.mileageUnit);
  const currency = usePreferencesStore((s) => s.currency);
  const label = economyLabel(u.units, mileage);
  if (!d.recording) {
    const now = d.instantL100km != null ? economy(d.instantL100km, u.units, mileage) : null;
    return (
      <View style={pageStyles.page}>
        <Text style={pageStyles.title}>NOT RECORDING</Text>
        {now ? <Figure label={`${label} now`} value={now.value} unit={now.unit} big /> : <Text style={pageStyles.hint}>Start a drive to see this trip here</Text>}
      </View>
    );
  }
  const drive = d.driveL100km != null ? economy(d.driveL100km, u.units, mileage) : null;
  const fuel = d.fuelUsedL != null ? fuelVolume(d.fuelUsedL, u.units) : null;
  return (
    <View style={pageStyles.page}>
      <Text style={pageStyles.title}>THIS DRIVE</Text>
      <View style={pageStyles.grid}>
        <Figure label="Time" value={formatClock(Math.round(d.driveS ?? 0))} big />
        <Figure label="Distance" value={u.distance(d.distanceM)} unit={u.distanceUnit} big />
        {drive ? <Figure label={label} value={drive.value} unit={drive.unit} /> : null}
        {fuel ? <Figure label="Fuel used" value={fuel.value} unit={fuel.unit} /> : null}
        {d.cost != null ? <Figure label="Cost" value={formatMoney(d.cost, currency)} /> : null}
      </View>
    </View>
  );
}

/** The Car page: the engine's vitals in a two-column list. */
export function CarPage({d}: {d: ClusterData}) {
  const u = useUnits();
  const unit = usePreferencesStore((s) => s.temperature);
  const rows: {label: string; value: string; unit?: string; warn?: boolean}[] = [];
  if (d.coolantC != null) {
    rows.push({label: 'Coolant', ...temperature(d.coolantC, unit), warn: d.alerts.hotCoolant});
  }
  if (d.voltage != null) {
    rows.push({label: 'Battery', value: d.voltage.toFixed(1), unit: 'V', warn: d.alerts.lowBattery});
  }
  if (d.boostKpa != null) {
    rows.push({label: 'Boost', ...pressure(d.boostKpa, u.units)});
  }
  if (d.intakeC != null) {
    rows.push({label: 'Intake air', ...temperature(d.intakeC, unit)});
  }
  if (d.oilC != null) {
    rows.push({label: 'Oil', ...temperature(d.oilC, unit)});
  }
  if (d.fuelPct != null) {
    rows.push({label: 'Fuel', value: String(Math.round(d.fuelPct)), unit: '%', warn: d.alerts.lowFuel});
  }
  if (d.rangeKm != null) {
    rows.push({label: 'Range', value: `≈${Math.round(u.distanceValue(d.rangeKm * 1000) ?? 0)}`, unit: u.distanceUnit});
  }
  return (
    <View style={pageStyles.page}>
      <Text style={pageStyles.title}>CAR</Text>
      <View style={pageStyles.grid}>
        {rows.map((r) => (
          <View key={r.label} style={pageStyles.figure}>
            <Text style={[pageStyles.label, r.warn && {color: CLUSTER_INK.amber}]}>{r.label}</Text>
            <View style={pageStyles.valueRow}>
              <Text style={[pageStyles.value, r.warn && {color: CLUSTER_INK.amber}]}>{r.value}</Text>
              {r.unit ? <Text style={pageStyles.unit}>{r.unit}</Text> : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export const pageStyles = StyleSheet.create({
  page: {flex: 1, paddingHorizontal: 20, paddingTop: 14, alignItems: 'center'},
  title: {color: CLUSTER_INK.textFaint, fontFamily: FONT.extrabold, fontSize: 11, letterSpacing: 2, marginBottom: 12},
  hint: {color: CLUSTER_INK.textDim, fontFamily: FONT.bold, fontSize: 14, marginTop: 20},
  grid: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 26, rowGap: 10},
  figure: {minWidth: 110, alignItems: 'center'},
  label: {color: CLUSTER_INK.textDim, fontFamily: FONT.bold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase'},
  valueRow: {flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2},
  value: {color: CLUSTER_INK.text, fontFamily: FONT.black, fontSize: 18, fontVariant: ['tabular-nums']},
  big: {fontSize: 26},
  unit: {color: CLUSTER_INK.textDim, fontFamily: FONT.bold, fontSize: 12},
});
