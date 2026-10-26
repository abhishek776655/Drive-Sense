import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {useMemo, useState} from 'react';
import {Pressable, View} from 'react-native';
import {AppText} from '../../components/AppText';
import {BentoTile} from '../../components/BentoTile';
import {Card} from '../../components/Card';
import {ActionButton} from '../../components/ActionButton';
import {StickyHeaderScroll} from '../../components/StickyHeaderScroll';
import {useTabBarInset} from '../../components/tabBarLayout';
import {AdapterCard, LINK_TEXT} from '../../components/telemetry/AdapterCard';
import {CarStateChip, useCarState} from '../../components/telemetry/CarStateChip';
import {PairSheet} from '../../components/telemetry/PairSheet';
import {RpmDial} from '../../components/telemetry/RpmDial';
import {CheckEngineCard} from '../../components/telemetry/CheckEngineCard';
import {Sparkline} from '../../components/telemetry/Sparkline';
import {ThisDriveCard} from '../../components/telemetry/ThisDriveCard';
import {getDb} from '../../db';
import {carDrives} from '../../db/obdRepos';
import {useDriveFuel} from '../../hooks/useDriveMileage';
import {useRange} from '../../hooks/useRange';
import {todayFuel} from '../../stats/todayFuel';
import {useSyncStore} from '../../sync/syncStore';
import {useUnits} from '../../hooks/useUnits';
import {fuelFlowUnits, gearLabel, obdTiles, powerUnits, torqueUnits, type TileTone} from '../../obd/tiles';
import {useObdStore, type HistoryPoint} from '../../stores/obdStore';
import {usePreferencesStore} from '../../stores/preferencesStore';
import {useRecordingStore} from '../../stores/recordingStore';
import {useActiveVehicle} from '../../stores/vehicleStore';
import {useAppTheme} from '../../theme/ThemeProvider';
import {kmhInUnits} from '../../utils/units';

/** Where most petrol engines redline; diesels a good deal lower. */
const REDLINE = {petrol: 6000, diesel: 4500} as const;

function Explainer({icon, title, text, action}: {icon: keyof typeof Ionicons.glyphMap; title: string; text: string; action?: {label: string; onPress: () => void}}) {
  const c = useAppTheme().colors;
  return (
    <Card style={{padding: 22, alignItems: 'center', gap: 12}}>
      <View style={{width: 64, height: 64, borderRadius: 32, backgroundColor: c.accentTint, alignItems: 'center', justifyContent: 'center'}}>
        <Ionicons name={icon} size={30} color={c.accent} />
      </View>
      <AppText size={20} weight="black" style={{textAlign: 'center'}}>
        {title}
      </AppText>
      <AppText size={14} weight="semibold" tone="secondary" style={{textAlign: 'center'}}>
        {text}
      </AppText>
      {action ? <ActionButton label={action.label} onPress={action.onPress} height={48} size={16} style={{alignSelf: 'stretch', marginTop: 4}} /> : null}
    </Card>
  );
}

function Banner({icon, color, text}: {icon: keyof typeof Ionicons.glyphMap; color: string; text: string}) {
  return (
    <Card style={{paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10}}>
      <Ionicons name={icon} size={20} color={color} />
      <AppText size={14} weight="extrabold" style={{flex: 1}}>
        {text}
      </AppText>
    </Card>
  );
}

/**
 * Telemetry (spec 2026-10-25): live engine data from the paired OBD-II adapter. Pair first; then
 * it waits for the car, and once the car answers shows RPM, speed, gear and every value it reports.
 */
export default function TelemetryScreen() {
  const theme = useAppTheme();
  const c = theme.colors;
  const u = useUnits();
  const temperatureUnit = usePreferencesStore((s) => s.temperature);
  const mileage = usePreferencesStore((s) => s.mileageUnit);
  const vehicle = useActiveVehicle();
  const live = useRecordingStore((s) => s.status !== 'ready');
  const bottomInset = useTabBarInset(live);
  const {link, adapter, values, derived, history, mil, vin, codes} = useObdStore();
  const [pairing, setPairing] = useState(false);
  const state = useCarState();

  const connected = link === 'live' || link === 'engineOff';
  const tones: Record<TileTone, string> = {normal: c.textSecondary, warn: c.amber, alert: c.red};
  const range = useRange(vehicle?.id ?? null, values.fuelLevel?.v);
  const driveFuel = useDriveFuel();
  const syncVersion = useSyncStore((s) => s.version);
  const vehicleId = vehicle?.id ?? null;
  const today = useMemo(() => {
    const db = getDb();
    if (!db || !vehicleId) {
      return null;
    }
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    try {
      return todayFuel(carDrives(db), vehicleId, midnight.getTime(), driveFuel);
    } catch {
      return null;
    }
    // `syncVersion` is the signal that the saved drives changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId, syncVersion, driveFuel]);
  const tiles = useMemo(
    () =>
      obdTiles(values, derived, {
        units: u.units,
        temperature: temperatureUnit,
        engineRunning: link === 'live',
        rangeKm: range.km,
        mileage,
        todayL100km: today?.l100km ?? null,
        todayFuelL: today?.fuelL ?? null,
        tankLitres: range.tankLitres,
      }),
    [values, derived, u.units, temperatureUnit, link, range.km, range.tankLitres, mileage, today],
  );
  const spark = (pick: (p: HistoryPoint) => number | null) =>
    history.flatMap((p) => {
      const y = pick(p);
      return y == null ? [] : [{x: p.at, y}];
    });

  // The last minute as small graphs: RPM always, the others once the car has given that value.
  const seen = (pick: (p: HistoryPoint) => number | null) => history.some((p) => pick(p) != null);
  const power = derived.powerKw != null ? powerUnits(derived.powerKw, u.units) : null;
  const flow = derived.fuelFlow != null ? fuelFlowUnits(derived.fuelFlow, u.units) : null;
  const torque = derived.torqueNm != null ? torqueUnits(derived.torqueNm, u.units) : null;
  const peak = (pick: (p: HistoryPoint) => number | null, format: (n: number) => {value: string; unit: string}) => {
    const top = Math.max(...history.map((p) => pick(p) ?? -Infinity));
    return Number.isFinite(top) ? `Peak ${format(top).value} ${format(top).unit}` : null;
  };
  // Power and torque get a full-width graph each; the rest share rows.
  const wideGraphs = [
    {
      key: 'power',
      label: 'Power',
      value: power?.value ?? '—',
      unit: powerUnits(0, u.units).unit,
      pick: (p: HistoryPoint) => p.power,
      color: c.purple,
      peak: peak((p) => p.power, (n) => powerUnits(n, u.units)),
      show: seen((p) => p.power),
    },
    {
      key: 'torque',
      label: 'Torque',
      value: torque?.value ?? '—',
      unit: torqueUnits(0, u.units).unit,
      pick: (p: HistoryPoint) => p.torque,
      color: c.blue,
      peak: peak((p) => p.torque, (n) => torqueUnits(n, u.units)),
      show: seen((p) => p.torque),
    },
  ].filter((g) => g.show);
  const graphs = [
    {key: 'rpm', label: 'RPM', value: values.rpm ? String(Math.round(values.rpm.v)) : '—', unit: 'rpm', pick: (p: HistoryPoint) => p.rpm, color: c.accent, show: true},
    {key: 'flow', label: 'Fuel flow', value: flow?.value ?? '—', unit: fuelFlowUnits(0, u.units).unit, pick: (p: HistoryPoint) => p.fuelFlow, color: c.cyan, show: seen((p) => p.fuelFlow)},
    {
      key: 'accel',
      label: 'Acceleration',
      value: derived.accelMps2 != null ? derived.accelMps2.toFixed(1) : '—',
      unit: 'm/s²',
      pick: (p: HistoryPoint) => p.accel,
      color: c.green,
      show: seen((p) => p.accel),
    },
  ].filter((g) => g.show);

  const speedKmh = values.speed?.v ?? null;
  const redline = vehicle?.fuel_type === 'diesel' ? REDLINE.diesel : REDLINE.petrol;
  const otherCar = !!vin && !!adapter?.vin && vin !== adapter.vin;

  const body = () => {
    if (!vehicle) {
      return <Explainer icon="car" title="Add your vehicle" text="Add a vehicle in Garage first. Its OBD-II adapter pairs with it." />;
    }
    if (!adapter) {
      return (
        <Explainer
          icon="hardware-chip"
          title="Connect your OBD-II adapter"
          text="Plug a Bluetooth OBD-II adapter into the port under your dashboard, then turn the ignition on."
          action={{label: 'Connect to your car', onPress: () => setPairing(true)}}
        />
      );
    }
    if (link === 'unsupported') {
      return <Explainer icon="flash-off" title="No engine data" text="This car does not answer standard OBD-II requests. Electric cars and many hybrids don't." />;
    }
    if (link === 'bluetoothOff' || link === 'unauthorized' || link === 'unavailable') {
      return (
        <Explainer
          icon="bluetooth"
          title={LINK_TEXT[link]}
          text={link === 'unauthorized' ? 'Allow Bluetooth for DriveSense in Settings to reach your adapter.' : 'Turn Bluetooth on to reach your adapter.'}
        />
      );
    }
    if (!connected) {
      return <AdapterCard vehicleId={vehicle.id} onPair={() => setPairing(true)} />;
    }
    return (
      <>
        {otherCar ? <Banner icon="swap-horizontal" color={c.amber} text="This adapter is in a different car than the one it was paired with." /> : null}
        {mil?.on ? <CheckEngineCard codes={codes} count={mil.codes} /> : null}
        <CarStateChip />
        <RpmDial
          rpm={values.rpm?.v ?? null}
          speed={speedKmh == null ? '—' : String(kmhInUnits(speedKmh, u.units))}
          speedUnit={u.speedUnit}
          gear={link === 'live' ? gearLabel(derived.gear) : null}
          parked={state === 'parked'}
          redline={redline}
        />
        <ThisDriveCard />
        {wideGraphs.map((g) => (
          <Sparkline key={g.key} label={g.label} value={g.value} unit={g.unit} points={spark(g.pick)} color={g.color} height={72} peak={g.peak} />
        ))}
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.cardGap}}>
          {graphs.map((g) => (
            <View key={g.key} style={{flexBasis: '48%', flexGrow: 1}}>
              <Sparkline label={g.label} value={g.value} unit={g.unit} points={spark(g.pick)} color={g.color} />
            </View>
          ))}
        </View>
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.cardGap}}>
          {tiles.map((t) => (
            <BentoTile
              key={t.id}
              label={t.label}
              value={t.value}
              unit={t.unit}
              icon={t.icon}
              iconColor={tones[t.tone]}
              compact
              style={{flexBasis: '48%', flexGrow: 1}}
            />
          ))}
        </View>
        <AdapterCard vehicleId={vehicle.id} onPair={() => setPairing(true)} />
      </>
    );
  };

  return (
    <View style={{flex: 1}}>
      <StickyHeaderScroll kicker="Live" title="Telemetry" contentContainerStyle={{paddingBottom: bottomInset + 12, gap: theme.space.cardGap}}>
        {vehicle ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Open cluster" onPress={() => router.push('/cluster')}>
            {({pressed}) => (
              <Card style={{paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.7 : 1}}>
                <View style={{width: 36, height: 36, borderRadius: 18, backgroundColor: c.accentTint, alignItems: 'center', justifyContent: 'center'}}>
                  <Ionicons name="speedometer" size={19} color={c.accent} />
                </View>
                <View style={{flex: 1}}>
                  <AppText size={16} weight="extrabold">
                    Cluster
                  </AppText>
                  <AppText size={13} weight="semibold" tone="secondary">
                    Full-screen dashboard, turn your phone sideways
                  </AppText>
                </View>
                <Ionicons name="expand" size={20} color={c.textTertiary} />
              </Card>
            )}
          </Pressable>
        ) : null}
        {body()}
      </StickyHeaderScroll>
      {pairing && vehicle ? <PairSheet vehicleId={vehicle.id} vehicleName={vehicle.display_name} onClose={() => setPairing(false)} /> : null}
    </View>
  );
}
