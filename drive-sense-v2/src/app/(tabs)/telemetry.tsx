import {Ionicons} from '@expo/vector-icons';
import {useMemo, useState} from 'react';
import {Pressable, View} from 'react-native';
import {AppText} from '../../components/AppText';
import {BentoTile} from '../../components/BentoTile';
import {Card} from '../../components/Card';
import {ActionButton} from '../../components/ActionButton';
import {StickyHeaderScroll} from '../../components/StickyHeaderScroll';
import {useTabBarInset} from '../../components/tabBarLayout';
import {AdapterCard, LINK_TEXT} from '../../components/telemetry/AdapterCard';
import {PairSheet} from '../../components/telemetry/PairSheet';
import {RpmDial} from '../../components/telemetry/RpmDial';
import {Sparkline} from '../../components/telemetry/Sparkline';
import {useRange} from '../../hooks/useRange';
import {useUnits} from '../../hooks/useUnits';
import {setSimEngine, simControls, simulateDropout, SIM_DEVICE_ID} from '../../obd/simAdapter';
import {fuelFlow, gearLabel, obdTiles, type TileTone} from '../../obd/tiles';
import {useObdStore} from '../../stores/obdStore';
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

/** Development builds with the simulated adapter: engine off and on, and a Bluetooth dropout. */
function SimEngineSwitch() {
  const c = useAppTheme().colors;
  const [on, setOn] = useState(simControls.engineOn);
  const toggle = () => {
    setSimEngine(!on);
    setOn(!on);
  };
  const chip = (icon: keyof typeof Ionicons.glyphMap, color: string, label: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" onPress={onPress} style={({pressed}) => ({opacity: pressed ? 0.6 : 1})}>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: c.control}}>
        <Ionicons name={icon} size={16} color={color} />
        <AppText size={13} weight="extrabold" tone="secondary">
          {label}
        </AppText>
      </View>
    </Pressable>
  );
  return (
    <View style={{alignItems: 'center', gap: 8}}>
      {chip(on ? 'power' : 'flash', on ? c.red : c.green, `Simulator: ${on ? 'switch engine off' : 'start engine'}`, toggle)}
      {chip('bluetooth', c.blue, 'Simulator: adapter dropout 6 s', () => simulateDropout(6))}
    </View>
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
  const vehicle = useActiveVehicle();
  const live = useRecordingStore((s) => s.status !== 'ready');
  const recording = useRecordingStore((s) => s.status === 'recording');
  const bottomInset = useTabBarInset(live);
  const {link, adapter, values, derived, history, mil, vin} = useObdStore();
  const [pairing, setPairing] = useState(false);

  const connected = link === 'live' || link === 'engineOff';
  const tones: Record<TileTone, string> = {normal: c.textSecondary, warn: c.amber, alert: c.red};
  const range = useRange(vehicle?.id ?? null, values.fuelLevel?.v);
  const tiles = useMemo(
    () => obdTiles(values, derived, {units: u.units, temperature: temperatureUnit, engineRunning: link === 'live', rangeKm: range.km}),
    [values, derived, u.units, temperatureUnit, link, range.km],
  );
  const spark = (pick: (p: (typeof history)[number]) => number | null) =>
    history.flatMap((p) => {
      const y = pick(p);
      return y == null ? [] : [{x: p.at, y}];
    });

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
          title="See inside your engine"
          text="Plug a Bluetooth OBD-II adapter into the port under the dashboard. DriveSense reads RPM, temperatures, fuel use and more, live and with every drive."
          action={{label: 'Pair adapter', onPress: () => setPairing(true)}}
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
        {mil?.on ? <Banner icon="warning" color={c.amber} text={`Check engine light on · ${mil.codes} ${mil.codes === 1 ? 'code' : 'codes'}`} /> : null}
        {recording ? (
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center'}}>
            <View style={{width: 8, height: 8, borderRadius: 4, backgroundColor: c.red}} />
            <AppText size={13} weight="extrabold" tone="secondary">
              Saving to this drive
            </AppText>
          </View>
        ) : null}
        <RpmDial
          rpm={values.rpm?.v ?? null}
          speed={speedKmh == null ? '—' : String(kmhInUnits(speedKmh, u.units))}
          speedUnit={u.speedUnit}
          gear={link === 'live' ? gearLabel(derived.gear) : null}
          redline={redline}
        />
        <View style={{flexDirection: 'row', gap: theme.space.cardGap}}>
          <Sparkline label="RPM" value={values.rpm ? String(Math.round(values.rpm.v)) : '—'} unit="rpm" points={spark((p) => p.rpm)} color={c.accent} />
          <Sparkline
            label="Fuel flow"
            value={derived.fuelFlow != null ? fuelFlow(derived.fuelFlow, u.units).value : '—'}
            unit={fuelFlow(0, u.units).unit}
            points={spark((p) => p.fuelFlow)}
            color={c.cyan}
          />
        </View>
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.cardGap}}>
          {/* Fuel flow already has its sparkline above. */}
          {tiles.filter((t) => t.id !== 'fuelFlow').map((t) => (
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
        {__DEV__ && adapter.deviceId === SIM_DEVICE_ID ? <SimEngineSwitch /> : null}
      </>
    );
  };

  return (
    <View style={{flex: 1}}>
      <StickyHeaderScroll kicker="Live" title="Telemetry" contentContainerStyle={{paddingBottom: bottomInset + 12, gap: theme.space.cardGap}}>
        {body()}
      </StickyHeaderScroll>
      {pairing && vehicle ? <PairSheet vehicleId={vehicle.id} vehicleName={vehicle.display_name} onClose={() => setPairing(false)} /> : null}
    </View>
  );
}
