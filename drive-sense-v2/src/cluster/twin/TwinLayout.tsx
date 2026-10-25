import {Ionicons} from '@expo/vector-icons';
import {BlurView} from 'expo-blur';
import {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useUnits} from '../../hooks/useUnits';
import {FONT} from '../../theme/theme';
import {kmhInUnits} from '../../utils/units';
import {CLUSTER_INK} from '../accents';
import type {ClusterData} from '../clusterData';
import {dialMax, redlineHeat} from '../motion';
import {ArcDial} from '../parts/ArcDial';
import {BarGauge} from '../parts/BarGauge';
import {CentrePager} from '../parts/CentrePager';
import {GDial} from '../parts/GDial';
import {LoadMeter} from '../parts/LoadMeter';
import {MapPage} from '../parts/MapPage';
import {CarPage, TripPage} from '../parts/pages';

const STRIP_H = 44;
const COOLANT_RANGE = [40, 130];

/** Local time, refreshed each minute, for the strip. */
function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  return now.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
}

/** A warning lamp in the strip: lit amber or red, otherwise not drawn. */
function Lamp({icon, color}: {icon: keyof typeof Ionicons.glyphMap; color: string}) {
  return (
    <View style={[styles.lamp, {shadowColor: color}]}>
      <Ionicons name={icon} size={17} color={color} />
    </View>
  );
}

/**
 * "Twin" (spec 2026-10-25, cluster mode, section 3), inspired by Mercedes' twin-dial cluster: speed
 * on the left, RPM (or G without an adapter) on the right, a frosted centre panel of swipeable
 * pages between them, and a strip of bar gauges and warning lamps along the bottom.
 */
export function TwinLayout({d, width, height, accent}: {d: ClusterData; width: number; height: number; accent: string}) {
  const u = useUnits();
  const clock = useClock();
  const dial = Math.min((height - STRIP_H) * 0.96, width * 0.34);
  const panelW = Math.max(220, width - dial * 2 - 24);
  const panelH = (height - STRIP_H) * 0.82;
  const imperial = u.units === 'imperial';
  const speed = d.speedKmh == null ? null : kmhInUnits(d.speedKmh, u.units);
  const speedMax = dialMax(imperial ? 140 : 220, 20, speed);

  const pages = [{key: 'trip', node: <TripPage d={d} />}];
  if (d.mode === 'adapter') {
    pages.push({
      key: 'engine',
      node: <LoadMeter width={panelW} height={panelH - 14} loadPct={d.loadPct} throttlePct={d.throttlePct} coasting={d.coasting} boostKpa={d.boostKpa} accent={accent} />,
    });
    pages.push({key: 'car', node: <CarPage d={d} />});
  }
  pages.push({key: 'map', node: <MapPage accent={accent} />});

  const coolantShare = d.coolantC == null ? null : Math.min(1, Math.max(0, (d.coolantC - COOLANT_RANGE[0]) / (COOLANT_RANGE[1] - COOLANT_RANGE[0])));
  const stateLabel = d.carState === 'engineOff' ? 'ENGINE OFF' : d.carState === 'parked' ? 'PARKED' : d.mode === 'phoneOnly' ? 'PHONE ONLY' : null;

  return (
    <View style={{width, height}}>
      <View style={styles.row}>
        <ArcDial size={dial} value={speed} max={speedMax} majorStep={20} minorStep={10} accent={accent} unit={u.speedUnit} />
        <View style={[styles.panel, {width: panelW, height: panelH}]}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <CentrePager pages={pages} width={panelW} height={panelH - 10} accent={accent} />
        </View>
        {d.mode === 'adapter' ? (
          <ArcDial
            size={dial}
            value={d.rpm}
            max={dialMax(8000, 1000, d.rpm)}
            majorStep={1000}
            minorStep={500}
            accent={accent}
            unit="× 1000 rpm"
            label={(v) => String(v / 1000)}
            redline={d.redline}
            redHeat={redlineHeat(d.rpm, d.redline)}
            settleMs={180}
            display={d.rpm == null ? '–' : Math.round(d.rpm).toLocaleString('en-US')}
            numberScale={0.15}
            footer={
              d.gear ? (
                <View style={[styles.gear, {borderColor: accent}]}>
                  <Text style={[styles.gearText, {color: accent}]}>{d.gear}</Text>
                </View>
              ) : null
            }
          />
        ) : (
          <GDial size={dial} g={d.g} accent={accent} />
        )}
      </View>
      <View style={[styles.strip, {height: STRIP_H}]}>
        <BarGauge icon="thermometer" share={coolantShare} color={d.alerts.hotCoolant ? CLUSTER_INK.red : accent} caption={null} />
        <View style={styles.lamps}>
          {d.alerts.checkEngine ? <Lamp icon="warning" color={CLUSTER_INK.amber} /> : null}
          {d.alerts.lowBattery ? <Lamp icon="battery-dead" color={CLUSTER_INK.amber} /> : null}
          {d.alerts.hotCoolant ? <Lamp icon="thermometer" color={CLUSTER_INK.red} /> : null}
          {d.alerts.lowFuel ? <Lamp icon="water" color={CLUSTER_INK.amber} /> : null}
          {stateLabel ? <Text style={styles.state}>{stateLabel}</Text> : null}
          <Text style={styles.clock}>{clock}</Text>
        </View>
        <BarGauge
          icon="color-fill"
          share={d.fuelPct == null ? null : d.fuelPct / 100}
          color={d.alerts.lowFuel ? CLUSTER_INK.amber : accent}
          caption={d.rangeKm != null ? `${Math.round(u.distanceValue(d.rangeKm * 1000) ?? 0)} ${u.distanceUnit}` : null}
          align="right"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  panel: {
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: CLUSTER_INK.glass,
    borderWidth: 1,
    borderColor: CLUSTER_INK.glassEdge,
    shadowColor: '#000000',
    shadowOpacity: 0.8,
    shadowRadius: 24,
    shadowOffset: {width: 0, height: 12},
  },
  gear: {marginTop: 8, minWidth: 34, height: 28, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8},
  gearText: {fontFamily: FONT.black, fontSize: 17},
  strip: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18},
  lamps: {flexDirection: 'row', alignItems: 'center', gap: 14},
  lamp: {shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: {width: 0, height: 0}},
  state: {color: CLUSTER_INK.textDim, fontFamily: FONT.extrabold, fontSize: 11, letterSpacing: 1.5},
  clock: {color: CLUSTER_INK.text, fontFamily: FONT.extrabold, fontSize: 15, fontVariant: ['tabular-nums']},
});
