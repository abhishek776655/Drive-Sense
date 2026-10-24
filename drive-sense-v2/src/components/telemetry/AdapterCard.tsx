import {Ionicons} from '@expo/vector-icons';
import {Alert, Pressable, View} from 'react-native';
import {getDb} from '../../db';
import {deleteAdapter} from '../../db/obdRepos';
import {useObdStore, type ObdLink} from '../../stores/obdStore';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {Card} from '../Card';
import {sinceLabel} from '../settings/DriveBackupSection';

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
    </Card>
  );
}
