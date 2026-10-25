import {Ionicons} from '@expo/vector-icons';
import {useEffect, useState} from 'react';
import {ActivityIndicator, Modal, Pressable, ScrollView, View} from 'react-native';
import {getDb} from '../../db';
import {putAdapter} from '../../db/obdRepos';
import {bleStatus, ensureBlePermission, scanAdapters, type FoundAdapter} from '../../obd/bleTransport';
import {useObdStore} from '../../stores/obdStore';
import {withAlpha} from '../../theme/color';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {Card} from '../Card';
import {GlassButton} from '../GlassButton';

type Phase = 'starting' | 'scanning' | 'blocked';

/**
 * Finds nearby OBD-II adapters and pairs the one tapped with the vehicle. Pairing only remembers it:
 * the link connects by itself (now, or once the car is switched on) and reads the VIN then.
 */
export function PairSheet({vehicleId, vehicleName, onClose}: {vehicleId: string; vehicleName: string; onClose: () => void}) {
  const c = useAppTheme().colors;
  const [phase, setPhase] = useState<Phase>('starting');
  const [problem, setProblem] = useState<string | null>(null);
  const [found, setFound] = useState<FoundAdapter[]>([]);

  useEffect(() => {
    let stop: (() => void) | null = null;
    let alive = true;
    void (async () => {
      const allowed = await ensureBlePermission();
      const status = allowed ? await bleStatus() : 'unauthorized';
      if (!alive) {
        return;
      }
      if (status !== 'on') {
        setPhase('blocked');
        setProblem(
          status === 'off'
            ? 'Bluetooth is off. Turn it on in Control Center, then try again.'
            : status === 'unauthorized'
              ? 'DriveSense needs Bluetooth access. Allow it in Settings, then try again.'
              : 'Bluetooth is not available on this device.',
        );
        return;
      }
      setPhase('scanning');
      stop = scanAdapters(
        (adapter) => setFound((list) => (list.some((a) => a.id === adapter.id) ? list : [...list, adapter])),
        (message) => {
          setPhase('blocked');
          setProblem(message);
        },
      );
    })();
    return () => {
      alive = false;
      stop?.();
    };
  }, []);

  const pair = (adapter: FoundAdapter) => {
    const db = getDb();
    if (!db) {
      return;
    }
    const paired = {vehicleId, deviceId: adapter.id, deviceName: adapter.name, vin: null, supported: [], lastSeen: new Date().toISOString(), lastState: null};
    putAdapter(db, paired);
    useObdStore.getState().setAdapter(paired);
    onClose();
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{flex: 1, backgroundColor: c.canvas}}>
        <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12}}>
          <GlassButton accessibilityLabel="Cancel" onPress={onClose} style={{height: 44, paddingHorizontal: 18}}>
            <AppText size={17} weight="bold" tone="accent">
              Cancel
            </AppText>
          </GlassButton>
          <AppText size={17} weight="extrabold">
            Pair adapter
          </AppText>
          <View style={{width: 88}} />
        </View>
        <ScrollView contentContainerStyle={{padding: 16, gap: 10}}>
          <AppText size={15} weight="semibold" tone="secondary" style={{marginBottom: 6}}>
            Plug the adapter into the OBD-II port under the dashboard and switch the ignition on. It pairs with {vehicleName}.
          </AppText>
          {phase === 'blocked' ? (
            <Card style={{padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center'}}>
              <Ionicons name="bluetooth" size={22} color={c.amber} />
              <AppText size={14} weight="bold" style={{flex: 1}}>
                {problem}
              </AppText>
            </Card>
          ) : null}
          {found.map((adapter) => (
            <Pressable key={adapter.id} accessibilityRole="button" accessibilityLabel={`Pair ${adapter.name}`} onPress={() => pair(adapter)}>
              {({pressed}) => (
                <Card style={{padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, opacity: pressed ? 0.7 : 1}}>
                  <View style={{width: 40, height: 40, borderRadius: 20, backgroundColor: c.accentTint, alignItems: 'center', justifyContent: 'center'}}>
                    <Ionicons name="hardware-chip" size={20} color={c.accent} />
                  </View>
                  <AppText size={16} weight="extrabold" style={{flex: 1}} numberOfLines={1}>
                    {adapter.name}
                  </AppText>
                  <AppText size={15} weight="extrabold" tone="accent">
                    Pair
                  </AppText>
                </Card>
              )}
            </Pressable>
          ))}
          {phase !== 'blocked' ? (
            <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18}}>
              <ActivityIndicator color={c.textSecondary} />
              <AppText size={14} weight="bold" tone="secondary">
                {found.length === 0 ? 'Looking for adapters…' : 'Still looking…'}
              </AppText>
            </View>
          ) : null}
          <AppText size={12} weight="semibold" color={withAlpha(c.textSecondary, 0.8)} style={{textAlign: 'center'}}>
            Works with Bluetooth LE ELM327 adapters such as Vgate iCar Pro BLE, OBDLink CX and Veepeak BLE.
          </AppText>
        </ScrollView>
      </View>
    </Modal>
  );
}
