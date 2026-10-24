import {Ionicons} from '@expo/vector-icons';
import {useState} from 'react';
import {Alert, Pressable, View} from 'react-native';
import {getDb} from '../../db';
import {deleteAdapter} from '../../db/obdRepos';
import {useRange} from '../../hooks/useRange';
import {useUnits} from '../../hooks/useUnits';
import {L_PER_US_GAL} from '../../obd/fuel';
import {useObdStore, type ObdLink} from '../../stores/obdStore';
import {TANK_LITRES_RANGE, usePreferencesStore} from '../../stores/preferencesStore';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {Card} from '../Card';
import {sinceLabel} from '../settings/DriveBackupSection';
import {NumberSheet} from '../settings/NumberSheet';

export const LINK_TEXT: Record<ObdLink, string> = {
  none: 'No adapter paired',
  bluetoothOff: 'Bluetooth is off',
  unauthorized: 'Bluetooth access needed',
  unavailable: 'Bluetooth not available',
  waiting: 'Waiting for your car',
  connecting: 'Connecting…',
  live: 'Connected',
  engineOff: 'Connected · engine off',
  unsupported: 'Car does not report engine data',
};

/** The paired adapter for a vehicle: its status, and Pair or Unpair (Garage and Telemetry). */
export function AdapterCard({vehicleId, onPair}: {vehicleId: string; onPair: () => void}) {
  const c = useAppTheme().colors;
  const adapter = useObdStore((s) => (s.adapter?.vehicleId === vehicleId ? s.adapter : null));
  const link = useObdStore((s) => s.link);
  const connected = link === 'live' || link === 'engineOff';
  const tint = connected ? c.green : link === 'none' ? c.textSecondary : link === 'unsupported' || link === 'bluetoothOff' || link === 'unauthorized' ? c.amber : c.textSecondary;

  const unpair = () =>
    Alert.alert('Unpair adapter?', 'DriveSense stops reading engine data for this vehicle. Drives already saved keep theirs.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Unpair',
        style: 'destructive',
        onPress: () => {
          const db = getDb();
          if (db) {
            deleteAdapter(db, vehicleId);
          }
          useObdStore.getState().setAdapter(null);
        },
      },
    ]);

  const state = adapter?.lastState;
  const u = useUnits();
  const [tankSheet, setTankSheet] = useState(false);
  const liveFuel = useObdStore((st) => st.values.fuelLevel?.v ?? null);
  const fuelLevel = connected ? liveFuel : (state?.fuelLevel ?? null);
  const range = useRange(vehicleId, fuelLevel);
  const imperial = u.units === 'imperial';
  const tankShown = range.tankLitres == null ? null : imperial ? range.tankLitres / L_PER_US_GAL : range.tankLitres;
  const saveTank = (value: number | null) => {
    const tanks = {...usePreferencesStore.getState().tankLitres};
    if (value == null) {
      delete tanks[vehicleId];
    } else {
      tanks[vehicleId] = imperial ? value * L_PER_US_GAL : value;
    }
    void usePreferencesStore.getState().set({tankLitres: tanks});
    setTankSheet(false);
  };
  return (
    <Card style={{padding: 16, gap: 12}}>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
        <View style={{width: 40, height: 40, borderRadius: 20, backgroundColor: c.accentTint, alignItems: 'center', justifyContent: 'center'}}>
          <Ionicons name="hardware-chip" size={20} color={c.accent} />
        </View>
        <View style={{flex: 1}}>
          <AppText size={16} weight="extrabold" numberOfLines={1}>
            {adapter?.deviceName ?? 'OBD-II adapter'}
          </AppText>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2}}>
            <View style={{width: 8, height: 8, borderRadius: 4, backgroundColor: tint}} />
            <AppText size={13} weight="bold" tone="secondary">
              {adapter ? LINK_TEXT[link] : LINK_TEXT.none}
            </AppText>
          </View>
        </View>
        <Pressable accessibilityRole="button" onPress={adapter ? unpair : onPair} hitSlop={8} style={({pressed}) => ({opacity: pressed ? 0.6 : 1, padding: 6})}>
          <AppText size={15} weight="extrabold" color={adapter ? c.red : c.accent}>
            {adapter ? 'Unpair' : 'Pair'}
          </AppText>
        </Pressable>
      </View>
      {adapter && !connected && state ? (
        <AppText size={13} weight="semibold" tone="tertiary">
          Last read {sinceLabel(state.readAt)}
          {state.fuelLevel != null ? ` · fuel ${Math.round(state.fuelLevel)}%` : ''}
          {state.voltage != null ? ` · battery ${state.voltage.toFixed(1)} V` : ''}
          {state.mil ? ' · check engine light on' : ''}
        </AppText>
      ) : null}
      {adapter ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Tank size" onPress={() => setTankSheet(true)} style={({pressed}) => ({opacity: pressed ? 0.6 : 1})}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: c.separator, paddingTop: 12}}>
            <Ionicons name="color-fill" size={18} color={c.cyan} />
            <AppText size={14} weight="bold" tone="secondary" style={{flex: 1}}>
              {tankShown != null ? `Tank ${Math.round(tankShown)} ${imperial ? 'gal' : 'L'}` : 'Set tank size for range'}
            </AppText>
            {range.km != null ? (
              <AppText size={14} weight="extrabold">
                ≈{Math.round(u.distanceValue(range.km * 1000) ?? 0)} {u.distanceUnit} left
              </AppText>
            ) : (
              <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
            )}
          </View>
        </Pressable>
      ) : null}
      {tankSheet ? (
        <NumberSheet
          title="Tank size"
          hint="How much fuel a full tank holds. With the fuel level from your adapter it gives the range left."
          unit={imperial ? 'gal' : 'L'}
          initial={tankShown}
          valid={(v) => {
            const litres = imperial ? v * L_PER_US_GAL : v;
            return litres >= TANK_LITRES_RANGE[0] && litres <= TANK_LITRES_RANGE[1];
          }}
          onSave={saveTank}
          onClose={() => setTankSheet(false)}
        />
      ) : null}
    </Card>
  );
}
