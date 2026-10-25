import {Ionicons} from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {LinearGradient} from 'expo-linear-gradient';
import {useEffect, useState, type ReactNode} from 'react';
import {Pressable, StyleSheet, Text, View, type ViewStyle} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming} from 'react-native-reanimated';
import {useUnits} from '../../hooks/useUnits';
import {FONT} from '../../theme/theme';
import {economy, temperature} from '../../obd/tiles';
import {usePreferencesStore} from '../../stores/preferencesStore';
import {kmhInUnits} from '../../utils/units';
import {CLUSTER_INK, DIAL_STYLE_NAMES, DIAL_STYLES, GAUGE_STYLES, type DialStyle} from '../accents';
import type {ClusterData} from '../clusterData';
import {dialMax, redlineHeat} from '../motion';
import {ArcDial} from '../parts/ArcDial';
import {BarGauge} from '../parts/BarGauge';
import {CentrePager} from '../parts/CentrePager';
import {GDial} from '../parts/GDial';
import {LoadBars} from '../parts/LoadBars';
import {LoadMeter} from '../parts/LoadMeter';
import {MapPage} from '../parts/MapPage';
import {CarPage, TripPage} from '../parts/pages';
import {AllTimePage, DrivingTotalsPage, GraphPage} from '../parts/statPages';
import {VerticalPager} from '../parts/VerticalPager';

const STRIP_H = 36;
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

/** Small readouts inside a dial, under its number: an icon and a value each. */
function DialInfo({items}: {items: {icon: keyof typeof Ionicons.glyphMap; text: string | null; warn?: boolean}[]}) {
  const shown = items.filter((i) => i.text != null);
  if (shown.length === 0) {
    return null;
  }
  return (
    <View style={styles.info}>
      {shown.map((i) => (
        <View key={i.icon} style={styles.infoItem}>
          <Ionicons name={i.icon} size={13} color={i.warn ? CLUSTER_INK.amber : CLUSTER_INK.textDim} />
          <Text style={[styles.infoText, i.warn && {color: CLUSTER_INK.amber}]}>{i.text}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * A dial that changes its own style when swiped up or down on, turning like a wheel: the old style
 * rolls away in the swipe's direction and the next one rolls in from the other side, with a light
 * tick and the style's name shown briefly under it.
 */
function DialSwitch({style, size, dialStyle, onSwitch, children}: {style: ViewStyle; size: number; dialStyle: DialStyle; onSwitch: (next: DialStyle) => void; children: ReactNode}) {
  const label = useSharedValue(0);
  const roll = useSharedValue(0);
  const [name, setName] = useState<string | null>(null);
  // Halfway through the roll (old style out of sight), swap in the next style and roll it in.
  const swapIn = (next: DialStyle, dir: number) => {
    onSwitch(next);
    setName(DIAL_STYLE_NAMES[next]);
    roll.set(withSequence(withTiming(-dir, {duration: 0}), withSpring(0, {dampingRatio: 0.8, duration: 450})));
    label.set(withSequence(withTiming(1, {duration: 150}), withDelay(900, withTiming(0, {duration: 400}))));
  };
  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetY([-18, 18])
    .failOffsetX([-14, 14])
    .onEnd((e) => {
      const up = e.translationY < 0;
      const dir = up ? -1 : 1;
      const i = DIAL_STYLES.indexOf(dialStyle);
      const next = DIAL_STYLES[(i + (up ? 1 : DIAL_STYLES.length - 1)) % DIAL_STYLES.length];
      void Haptics.selectionAsync().catch(() => undefined);
      roll.set(
        withTiming(dir, {duration: 170, easing: Easing.in(Easing.quad)}, (done) => {
          if (done) {
            runOnJS(swapIn)(next, dir);
          }
        }),
      );
    });
  const rollStyle = useAnimatedStyle(() => {
    const away = Math.min(1, Math.abs(roll.value));
    return {
      opacity: 1 - away,
      transform: [{perspective: 900}, {translateY: roll.value * size * 0.22}, {rotateX: `${-roll.value * 40}deg`}, {scale: 1 - away * 0.1}],
    };
  });
  const labelStyle = useAnimatedStyle(() => ({opacity: label.value, transform: [{translateY: (1 - label.value) * 6}]}));
  return (
    <GestureDetector gesture={swipe}>
      <View style={style}>
        <Animated.View style={rollStyle}>{children}</Animated.View>
        <Animated.View pointerEvents="none" style={[styles.switchLabel, labelStyle]}>
          <Text style={styles.switchText}>{name}</Text>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

/**
 * "Twin" (spec 2026-10-25, cluster mode, section 3), inspired by Mercedes' twin-dial cluster: speed
 * on the left, RPM (or G without an adapter) on the right, each with small readouts inside (swipe up or down on a dial to roll it to its other style); the
 * swipeable centre pages sit behind the dials with no panel and fade out under their rims; and a strip of bar gauges and warning lamps along the bottom.
 */
export function TwinLayout({d, width, height, accent}: {d: ClusterData; width: number; height: number; accent: string}) {
  const u = useUnits();
  const clock = useClock();
  const tempUnit = usePreferencesStore((s) => s.temperature);
  const mileage = usePreferencesStore((s) => s.mileageUnit);
  const speedStyle = usePreferencesStore((s) => s.clusterSpeedDial);
  const revStyle = usePreferencesStore((s) => s.clusterRevDial);
  const gaugeStyle = usePreferencesStore((s) => s.clusterGaugeStyle);
  const setPrefs = usePreferencesStore((s) => s.set);
  const nextGauge = () => void setPrefs({clusterGaugeStyle: GAUGE_STYLES[(GAUGE_STYLES.indexOf(gaugeStyle) + 1) % GAUGE_STYLES.length]});
  const rowH = height - STRIP_H;
  // Big dials that reach into the centre; the centre sits behind them and fades out under their rims.
  const dial = Math.min(rowH * 1.06, width * 0.43);
  const overlap = dial * 0.1;
  // The centre takes a little less than the room between the dials, and the dials close in by as much.
  const panelW = Math.max(200, (width - dial * 2 + overlap * 2) * 0.88);
  const groupX = (width - (dial * 2 + panelW - overlap * 2)) / 2;
  const panelH = rowH * 0.86;
  // The centre layer runs on under the dials by this much; only the map uses it, other pages are
  // padded back to the visible gap.
  const under = dial * 0.28;
  const layerW = panelW + under * 2;
  const fadeW = under + overlap + 40;
  const imperial = u.units === 'imperial';
  const speed = d.speedKmh == null ? null : kmhInUnits(d.speedKmh, u.units);
  const speedMax = dialMax(imperial ? 140 : 220, 20, speed);
  const range = d.rangeKm != null ? `${Math.round(u.distanceValue(d.rangeKm * 1000) ?? 0)} ${u.distanceUnit}` : null;
  const instant = d.instantL100km != null ? economy(d.instantL100km, u.units, mileage) : null;
  const coolant = d.coolantC != null ? temperature(d.coolantC, tempUnit) : null;

  const inset = (node: ReactNode) => <View style={{flex: 1, paddingHorizontal: under}}>{node}</View>;
  // Trip and Engine each have more views, a swipe up or down away.
  const pages = [
    {
      key: 'trip',
      node: inset(
        <VerticalPager
          height={panelH}
          accent={accent}
          views={[
            {key: 'drive', node: <TripPage d={d} />},
            {key: 'totals', node: <DrivingTotalsPage />},
            {key: 'all', node: <AllTimePage />},
            {key: 'graph', node: <GraphPage width={panelW} accent={accent} />},
          ]}
        />,
      ),
    },
  ];
  if (d.mode === 'adapter') {
    const engine = {loadPct: d.loadPct, throttlePct: d.throttlePct, coasting: d.coasting, boostKpa: d.boostKpa, accent};
    pages.push({
      key: 'engine',
      node: inset(
        <VerticalPager
          height={panelH}
          accent={accent}
          views={[
            {key: 'arc', node: <LoadMeter width={panelW} height={panelH - 14} {...engine} />},
            {key: 'bars', node: <LoadBars width={panelW} height={panelH - 30} vertical={false} {...engine} />},
            {key: 'columns', node: <LoadBars width={panelW} height={panelH - 30} vertical {...engine} />},
          ]}
        />,
      ),
    });
    pages.push({key: 'car', node: inset(<CarPage d={d} />)});
  }
  pages.push({key: 'map', node: <MapPage accent={accent} />});

  const coolantShare = d.coolantC == null ? null : Math.min(1, Math.max(0, (d.coolantC - COOLANT_RANGE[0]) / (COOLANT_RANGE[1] - COOLANT_RANGE[0])));
  const stateLabel = d.carState === 'engineOff' ? 'ENGINE OFF' : d.carState === 'parked' ? 'PARKED' : d.mode === 'phoneOnly' ? 'PHONE ONLY' : null;

  return (
    <View style={{width, height}}>
      <View style={{height: rowH}}>
        <View style={[styles.centre, {left: (width - layerW) / 2, top: (rowH - panelH) / 2 + rowH * 0.06, width: layerW, height: panelH}]}>
          <CentrePager pages={pages} width={layerW} height={panelH - 10} accent={accent} />
          <LinearGradient pointerEvents="none" colors={[CLUSTER_INK.background, 'transparent']} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={[styles.fade, {left: 0, width: fadeW}]} />
          <LinearGradient pointerEvents="none" colors={['transparent', CLUSTER_INK.background]} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={[styles.fade, {right: 0, width: fadeW}]} />
        </View>
        <DialSwitch style={{...styles.dial, left: groupX, top: (rowH - dial) / 2}} size={dial} dialStyle={speedStyle} onSwitch={(next) => void setPrefs({clusterSpeedDial: next})}>
          <ArcDial
            size={dial}
            dialStyle={speedStyle}
            value={speed}
            max={speedMax}
            majorStep={20}
            minorStep={10}
            accent={accent}
            unit={u.speedUnit}
            footer={
              <DialInfo
                items={[
                  {icon: 'color-fill', text: range, warn: d.alerts.lowFuel},
                  {icon: 'leaf', text: instant ? `${instant.value} ${instant.unit}` : null},
                ]}
              />
            }
          />
        </DialSwitch>
        <DialSwitch style={{...styles.dial, right: groupX, top: (rowH - dial) / 2}} size={dial} dialStyle={revStyle} onSwitch={(next) => void setPrefs({clusterRevDial: next})}>
          {d.mode === 'adapter' ? (
            <ArcDial
              size={dial}
              dialStyle={revStyle}
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
              // In thousands, like the scale: 2.9 for 2,900 rpm.
              display={d.rpm == null ? '–' : (d.rpm / 1000).toFixed(1)}
              footer={
                <>
                  {/* Always there, so the gear has a known place; a dash until it is worked out. */}
                  <View style={[styles.gear, {borderColor: d.gear ? accent : CLUSTER_INK.textFaint}]}>
                    <Text style={[styles.gearText, {color: d.gear ? accent : CLUSTER_INK.textFaint}]}>{d.gear ?? '–'}</Text>
                  </View>
                  <DialInfo
                    items={[
                      {icon: 'thermometer', text: coolant ? `${coolant.value}${coolant.unit}` : null, warn: d.alerts.hotCoolant},
                      {icon: 'speedometer', text: d.loadPct != null ? `${Math.round(d.loadPct)}%` : null},
                    ]}
                  />
                </>
              }
            />
          ) : (
            <GDial size={dial} g={d.g} accent={accent} />
          )}
        </DialSwitch>
      </View>
      <View style={[styles.strip, {height: STRIP_H}]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Change gauge style" onPress={nextGauge} hitSlop={10}>
          <BarGauge icon="thermometer" share={coolantShare} color={d.alerts.hotCoolant ? CLUSTER_INK.red : accent} caption={null} value={coolant ? `${coolant.value}${coolant.unit}` : null} variant={gaugeStyle} />
        </Pressable>
        <View style={styles.lamps}>
          {d.alerts.checkEngine ? <Lamp icon="warning" color={CLUSTER_INK.amber} /> : null}
          {d.alerts.lowBattery ? <Lamp icon="battery-dead" color={CLUSTER_INK.amber} /> : null}
          {d.alerts.hotCoolant ? <Lamp icon="thermometer" color={CLUSTER_INK.red} /> : null}
          {d.alerts.lowFuel ? <Lamp icon="water" color={CLUSTER_INK.amber} /> : null}
          {stateLabel ? <Text style={styles.state}>{stateLabel}</Text> : null}
          <Text style={styles.clock}>{clock}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Change gauge style" onPress={nextGauge} hitSlop={10}>
          <BarGauge
            icon="color-fill"
            share={d.fuelPct == null ? null : d.fuelPct / 100}
            color={d.alerts.lowFuel ? CLUSTER_INK.amber : accent}
            caption={range}
            value={d.fuelPct == null ? null : `${Math.round(d.fuelPct)}%`}
            variant={gaugeStyle}
            align="right"
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: {position: 'absolute', overflow: 'hidden'},
  fade: {position: 'absolute', top: 0, bottom: 0},
  dial: {position: 'absolute'},
  switchLabel: {position: 'absolute', left: 0, right: 0, bottom: '9%', alignItems: 'center'},
  switchText: {color: CLUSTER_INK.text, fontFamily: FONT.extrabold, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase'},
  info: {flexDirection: 'row', gap: 12, marginTop: 8},
  infoItem: {flexDirection: 'row', alignItems: 'center', gap: 4},
  infoText: {color: CLUSTER_INK.textDim, fontFamily: FONT.bold, fontSize: 12, fontVariant: ['tabular-nums']},
  gear: {marginTop: 8, minWidth: 34, height: 28, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8},
  gearText: {fontFamily: FONT.black, fontSize: 17},
  strip: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18},
  lamps: {flexDirection: 'row', alignItems: 'center', gap: 14},
  lamp: {shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: {width: 0, height: 0}},
  state: {color: CLUSTER_INK.textDim, fontFamily: FONT.extrabold, fontSize: 11, letterSpacing: 1.5},
  clock: {color: CLUSTER_INK.text, fontFamily: FONT.extrabold, fontSize: 15, fontVariant: ['tabular-nums']},
});
