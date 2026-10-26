import { StyleSheet, Text, View } from 'react-native';
import { useUnits } from '../../hooks/useUnits';
import { formatMoney } from '../../obd/fuel';
import { economy, economyLabel, fuelVolume, pressure, temperature } from '../../obd/tiles';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { FONT } from '../../theme/theme';
import { formatClock } from '../../utils/format';
import { CLUSTER_INK } from '../accents';
import type { ClusterData } from '../clusterData';
import { shows } from '../settings';

/** One figure on a page: small caps label, value, unit. */
export function Figure({ label, value, unit, big }: { label: string; value: string; unit?: string; big?: boolean }) {
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
export function TripPage({ d }: { d: ClusterData }) {
  const u = useUnits();
  const mileage = usePreferencesStore((s) => s.mileageUnit);
  const currency = usePreferencesStore((s) => s.currency);
  const chosen = usePreferencesStore((s) => s.clusterDriveStats);
  const label = economyLabel(u.units, mileage);
  if (!d.recording) {
    const now = d.instantL100km != null ? economy(d.instantL100km, u.units, mileage) : null;
    return (
      <View style={pageStyles.page}>
        <Text style={pageStyles.title}>NOT RECORDING</Text>
        {now ? <Figure label={`${label} now`} value={now.value} unit={now.unit} big /> : <Text style={pageStyles.hint}>Start a drive to view</Text>}
      </View>
    );
  }
  const drive = d.driveL100km != null ? economy(d.driveL100km, u.units, mileage) : null;
  const fuel = d.fuelUsedL != null ? fuelVolume(d.fuelUsedL, u.units) : null;
  // Settings decides which of these this page lists.
  const on = (key: string) => shows(chosen, key);
  return (
    <View style={pageStyles.page}>
      <Text style={pageStyles.title}>THIS DRIVE</Text>
      <View style={pageStyles.grid}>
        {on('time') ? <Figure label="Time" value={formatClock(Math.round(d.driveS ?? 0))} big /> : null}
        {on('distance') ? <Figure label="Distance" value={u.distance(d.distanceM)} unit={u.distanceUnit} big /> : null}
        {on('mileage') && drive ? <Figure label={label} value={drive.value} unit={drive.unit} /> : null}
        {on('fuelUsed') && fuel ? <Figure label="Fuel used" value={fuel.value} unit={fuel.unit} /> : null}
        {on('cost') && d.cost != null ? <Figure label="Cost" value={formatMoney(d.cost, currency)} /> : null}
        {on('avgSpeed') && d.avgSpeedMps != null ? <Figure label="Avg speed" value={u.speed(d.avgSpeedMps)} unit={u.speedUnit} /> : null}
      </View>
    </View>
  );
}

/** The Car page: the engine's vitals in a two-column list. */
export function CarPage({ d }: { d: ClusterData }) {
  const u = useUnits();
  const unit = usePreferencesStore((s) => s.temperature);
  const chosen = usePreferencesStore((s) => s.clusterCarStats);
  const rows: { label: string; value: string; unit?: string; warn?: boolean }[] = [];
  if (shows(chosen, 'engineTemp') && d.coolantC != null) {
    rows.push({ label: 'Engine temp', ...temperature(d.coolantC, unit), warn: d.alerts.hotCoolant });
  }
  if (shows(chosen, 'battery') && d.voltage != null) {
    rows.push({ label: 'Battery', value: d.voltage.toFixed(1), unit: 'V', warn: d.alerts.lowBattery });
  }
  if (shows(chosen, 'boost') && d.boostKpa != null) {
    rows.push({ label: 'Boost', ...pressure(d.boostKpa, u.units) });
  }
  if (shows(chosen, 'intake') && d.intakeC != null) {
    rows.push({ label: 'Intake air', ...temperature(d.intakeC, unit) });
  }
  if (shows(chosen, 'oil') && d.oilC != null) {
    rows.push({ label: 'Oil', ...temperature(d.oilC, unit) });
  }
  if (shows(chosen, 'fuel') && d.fuelPct != null) {
    // Litres beside the percent when the tank size is known, as on the Telemetry tile.
    const left = d.fuelLitres != null ? fuelVolume(d.fuelLitres, u.units) : null;
    rows.push({ label: 'Fuel', value: String(Math.round(d.fuelPct)), unit: left ? `% · ${left.value} ${left.unit}` : '%', warn: d.alerts.lowFuel });
  }
  if (shows(chosen, 'range') && d.rangeKm != null) {
    rows.push({ label: 'Range', value: `≈${Math.round(u.distanceValue(d.rangeKm * 1000) ?? 0)}`, unit: u.distanceUnit });
  }
  if (shows(chosen, 'odometer') && d.odometerKm != null) {
    rows.push({ label: 'Odometer', value: Math.round(u.distanceValue(d.odometerKm * 1000) ?? 0).toLocaleString('en-US'), unit: u.distanceUnit });
  }
  return (
    <View style={pageStyles.page}>
      <Text style={pageStyles.title}>CAR</Text>
      <View style={pageStyles.grid}>
        {rows.map((r) => (
          <View key={r.label} style={pageStyles.figure}>
            <Text style={[pageStyles.label, r.warn && { color: CLUSTER_INK.amber }]}>{r.label}</Text>
            <View style={pageStyles.valueRow}>
              <Text style={[pageStyles.value, r.warn && { color: CLUSTER_INK.amber }]}>{r.value}</Text>
              {r.unit ? <Text style={pageStyles.unit}>{r.unit}</Text> : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export const pageStyles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 16, paddingTop: 14, alignItems: 'center' },
  // Full width and centred, so long text wraps inside the narrow pane instead of spilling out.
  title: { alignSelf: 'stretch', textAlign: 'center', color: CLUSTER_INK.textFaint, fontFamily: FONT.extrabold, fontSize: 11, letterSpacing: 2, marginBottom: 12 },
  hint: { alignSelf: 'stretch', textAlign: 'center', color: CLUSTER_INK.textDim, fontFamily: FONT.bold, fontSize: 13, lineHeight: 18, marginTop: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 10, rowGap: 10 },
  figure: { minWidth: 92, alignItems: 'center' },
  label: { color: CLUSTER_INK.textDim, fontFamily: FONT.bold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 },
  value: { color: CLUSTER_INK.text, fontFamily: FONT.black, fontSize: 18, fontVariant: ['tabular-nums'] },
  big: { fontSize: 20 },
  unit: { color: CLUSTER_INK.textDim, fontFamily: FONT.bold, fontSize: 12 },
});
