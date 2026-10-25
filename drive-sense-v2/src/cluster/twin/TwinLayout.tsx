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
import {CLUSTER_INK, DIAL_STYLE_NAMES, DIAL_STYLES, GAUGE_STYLES, PHONE_DIAL_NAMES, PHONE_DIALS} from '../accents';
import type {ClusterData} from '../clusterData';
import {dialMax, gPoint, redlineHeat} from '../motion';
import {ArcDial} from '../parts/ArcDial';
import {BarGauge} from '../parts/BarGauge';
import {CentrePager} from '../parts/CentrePager';
import {ClimbDial} from '../parts/ClimbDial';
import {CompassDial} from '../parts/CompassDial';
import {GDial} from '../parts/GDial';
import {SpeedGraphDial} from '../parts/SpeedGraphDial';
import {usePhoneTrace} from '../usePhoneTrace';
import {LoadBars} from '../parts/LoadBars';
import {LoadMeter} from '../parts/LoadMeter';
import {SideArc} from '../parts/SideArc';
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
function DialInfo({items, maxWidth}: {items: {icon: keyof typeof Ionicons.glyphMap; text: string | null; warn?: boolean}[]; maxWidth?: number}) {
  const shown = items.filter((i) => i.text != null);
  if (shown.length === 0) {
    return null;
  }
  return (
    <View style={[styles.info, maxWidth != null && {maxWidth}]}>
      {shown.map((i) => (
        <View key={i.icon} style={styles.infoItem}>
          <Ionicons name={i.icon} size={13} color={i.warn ? CLUSTER_INK.amber : CLUSTER_INK.textDim} />
          <Text style={[styles.infoText, i.warn && {color: CLUSTER_INK.amber}]}>{i.text}</Text>
        </View>
      ))}
    </View>
  );
}

/** G-force as a dot in a small ring: up speeding up, down braking, sideways cornering. */
function GDot({g, accent}: {g: {lon: number; lat: number}; accent: string}) {
  const p = gPoint(g, 9);
  return (
    <View style={styles.gRing} accessibilityLabel="G-force">
      <View style={[styles.gDot, {backgroundColor: accent, shadowColor: accent, transform: [{translateX: p.x}, {translateY: p.y}]}]} />
    </View>
  );
}

/**
 * A dial that rolls to its next option (a style, or what it shows) when swiped up or down on,
 * turning like a wheel: the old one rolls away in the swipe's direction and the next rolls in, with a light
 * tick and the style's name shown briefly under it.
 */
function DialSwitch<T extends string>({style, size, options, names, value, onSwitch, children}: {style: ViewStyle; size: number; options: readonly T[]; names: Record<T, string>; value: T; onSwitch: (next: T) => void; children: ReactNode}) {
  const label = useSharedValue(0);
  const roll = useSharedValue(0);
  const [name, setName] = useState<string | null>(null);
  // Halfway through the roll (old style out of sight), swap in the next style and roll it in.
  const swapIn = (next: T, dir: number) => {
    onSwitch(next);
    setName(names[next]);
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
      const i = options.indexOf(value);
      const next = options[(i + (up ? 1 : options.length - 1)) % options.length];
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
  const phoneDial = usePreferencesStore((s) => s.clusterPhoneDial);
  const trace = usePhoneTrace();
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
    pages.push({
      key: 'car',
      node: inset(
        <VerticalPager
          height={panelH}
          accent={accent}
          views={[
            {key: 'now', node: <CarPage d={d} />},
            {key: 'all', node: <AllTimePage />},
          ]}
        />,
      ),
    });
  }
  pages.push({key: 'map', node: <MapPage accent={accent} />});

  const coolantShare = d.coolantC == null ? null : Math.min(1, Math.max(0, (d.coolantC - COOLANT_RANGE[0]) / (COOLANT_RANGE[1] - COOLANT_RANGE[0])));
  const outside = d.outsideC != null ? temperature(d.outsideC, tempUnit) : null;
  // Fuel and coolant are the car's: without the adapter there is nothing to show.
  const carGauges = d.mode === 'adapter';
  const arcs = carGauges && gaugeStyle === 'arc';
  const stripGauge = !carGauges || gaugeStyle === 'arc' ? null : gaugeStyle;
  const fuelColor = d.alerts.lowFuel ? CLUSTER_INK.amber : accent;
  const coolantColor = d.alerts.hotCoolant ? CLUSTER_INK.red : accent;
  const dialTop = (rowH - dial) / 2;
  const stateLabel = d.carState === 'engineOff' ? 'ENGINE OFF' : d.carState === 'parked' ? 'PARKED' : d.mode === 'phoneOnly' ? 'PHONE ONLY' : null;

  return (
    <View style={{width, height}}>
      <View style={{height: rowH}}>
        <View style={[styles.centre, {left: (width - layerW) / 2, top: (rowH - panelH) / 2 + rowH * 0.06, width: layerW, height: panelH}]}>
          <CentrePager pages={pages} width={layerW} height={panelH - 10} accent={accent} />
          <LinearGradient pointerEvents="none" colors={[CLUSTER_INK.background, 'transparent']} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={[styles.fade, {left: 0, width: fadeW}]} />
          <LinearGradient pointerEvents="none" colors={['transparent', CLUSTER_INK.background]} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={[styles.fade, {right: 0, width: fadeW}]} />
        </View>
        {/* Outside air and heading, along the top between the dials. */}
        {outside || d.heading ? (
          <View pointerEvents="none" style={styles.topLine}>
            {outside ? (
              <View style={styles.infoItem}>
                <Ionicons name="partly-sunny" size={13} color={CLUSTER_INK.textDim} />
                <Text style={styles.topText}>
                  {outside.value}
                  {outside.unit}
                </Text>
              </View>
            ) : null}
            {d.heading ? (
              <View style={styles.infoItem}>
                <Ionicons name="navigate" size={12} color={CLUSTER_INK.textDim} />
                <Text style={styles.topText}>{d.heading}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {arcs ? (
          <>
            <SideArc size={dial} left={groupX} top={dialTop} side="left" share={coolantShare} color={coolantColor} icon="thermometer" value={coolant ? `${coolant.value}${coolant.unit}` : null} onPress={nextGauge} />
            <SideArc size={dial} left={width - groupX - dial} top={dialTop} side="right" share={d.fuelPct == null ? null : d.fuelPct / 100} color={fuelColor} icon="color-fill" value={d.fuelPct == null ? null : `${Math.round(d.fuelPct)}%`} onPress={nextGauge} />
          </>
        ) : null}
        <DialSwitch style={{...styles.dial, left: groupX, top: (rowH - dial) / 2}} size={dial} options={DIAL_STYLES} names={DIAL_STYLE_NAMES} value={speedStyle} onSwitch={(next) => void setPrefs({clusterSpeedDial: next})}>
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
                // Needle style keeps them in the narrow space between the bottom scale labels.
                maxWidth={speedStyle === 'needle' ? dial * 0.34 : undefined}
                items={[
                  // This drive's distance while recording, else how far the tank goes.
                  d.distanceM != null ? {icon: 'navigate-circle', text: `${u.distance(d.distanceM)} ${u.distanceUnit}`} : {icon: 'color-fill', text: range, warn: d.alerts.lowFuel},
                  {icon: 'leaf', text: instant ? `${instant.value} ${instant.unit}` : null},
                ]}
              />
            }
          />
        </DialSwitch>
        {d.mode === 'adapter' ? (
          <DialSwitch style={{...styles.dial, right: groupX, top: dialTop}} size={dial} options={DIAL_STYLES} names={DIAL_STYLE_NAMES} value={revStyle} onSwitch={(next) => void setPrefs({clusterRevDial: next})}>
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
                    <View style={styles.gearRow}>
                      <View style={[styles.gear, {borderColor: d.gear ? accent : CLUSTER_INK.textFaint}]}>
                        <Text style={[styles.gearText, {color: d.gear ? accent : CLUSTER_INK.textFaint}]}>{d.gear ?? '–'}</Text>
                      </View>
                      {/* Shift-up hint: high revs in a low gear. */}
                      {d.shiftUp ? (
                        <View style={styles.shift}>
                          <Ionicons name="arrow-up" size={13} color={CLUSTER_INK.green} />
                          <Text style={styles.shiftText}>{d.shiftUp}</Text>
                        </View>
                      ) : null}
                    </View>
                    <DialInfo items={[{icon: 'speedometer', text: d.loadPct != null ? `${Math.round(d.loadPct)}%` : null}]} />
                  </>
                }
              />
          </DialSwitch>
        ) : (
          // Without the adapter the right dial rolls between G-force, climb, compass and a speed graph.
          <DialSwitch style={{...styles.dial, right: groupX, top: dialTop}} size={dial} options={PHONE_DIALS} names={PHONE_DIAL_NAMES} value={phoneDial} onSwitch={(next) => void setPrefs({clusterPhoneDial: next})}>
            {phoneDial === 'climb' ? (
              <ClimbDial size={dial} accent={accent} altitudeM={trace.altitudeM} gradePct={trace.gradePct} />
            ) : phoneDial === 'compass' ? (
              <CompassDial size={dial} accent={accent} headingDeg={trace.headingDeg} />
            ) : phoneDial === 'speed' ? (
              <SpeedGraphDial size={dial} accent={accent} trace={trace.speed} />
            ) : (
              <GDial size={dial} g={d.g} accent={accent} />
            )}
          </DialSwitch>
        )}
      </View>
      <View style={[styles.strip, {height: STRIP_H}]}>
        <View style={styles.stripSide}>
          {stripGauge ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Change gauge style" onPress={nextGauge} hitSlop={10}>
              <BarGauge icon="thermometer" share={coolantShare} color={coolantColor} caption={null} value={coolant ? `${coolant.value}${coolant.unit}` : null} variant={stripGauge} />
            </Pressable>
          ) : null}
          {d.voltage != null ? (
            <View style={styles.infoItem}>
              <Ionicons name="battery-half" size={14} color={d.alerts.lowBattery ? CLUSTER_INK.amber : CLUSTER_INK.textDim} />
              <Text style={styles.stripText}>{d.voltage.toFixed(1)} V</Text>
            </View>
          ) : null}
          {d.events ? (
            // Harsh brakes (down arrow) and hard accelerations (up arrow) this drive.
            <View style={styles.infoItem} accessibilityLabel={`${d.events.brake} harsh brakes, ${d.events.accel} hard accelerations this drive`}>
              <Ionicons name="arrow-down-circle" size={14} color={d.events.brake > 0 ? CLUSTER_INK.amber : CLUSTER_INK.textDim} />
              <Text style={styles.stripText}>{d.events.brake}</Text>
              <Ionicons name="arrow-up-circle" size={14} color={d.events.accel > 0 ? CLUSTER_INK.amber : CLUSTER_INK.textDim} style={styles.gapLeft} />
              <Text style={styles.stripText}>{d.events.accel}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.lamps}>
          {d.alerts.checkEngine ? <Lamp icon="warning" color={CLUSTER_INK.amber} /> : null}
          {d.alerts.lowBattery ? <Lamp icon="battery-dead" color={CLUSTER_INK.amber} /> : null}
          {d.alerts.hotCoolant ? <Lamp icon="thermometer" color={CLUSTER_INK.red} /> : null}
          {d.alerts.lowFuel ? <Lamp icon="water" color={CLUSTER_INK.amber} /> : null}
          {stateLabel ? <Text style={styles.state}>{stateLabel}</Text> : null}
          <Text style={styles.clock}>{clock}</Text>
        </View>
        <View style={[styles.stripSide, styles.stripRight]}>
          {stripGauge ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Change gauge style" onPress={nextGauge} hitSlop={10}>
              <BarGauge icon="color-fill" share={d.fuelPct == null ? null : d.fuelPct / 100} color={fuelColor} caption={range} value={d.fuelPct == null ? null : `${Math.round(d.fuelPct)}%`} variant={stripGauge} align="right" />
            </Pressable>
          ) : null}
          {d.speedLimitKmh != null ? (
            <View style={styles.limit} accessibilityLabel={`Speed alert at ${kmhInUnits(d.speedLimitKmh, u.units)} ${u.speedUnit}`}>
              <Text style={styles.limitText}>{kmhInUnits(d.speedLimitKmh, u.units)}</Text>
            </View>
          ) : null}
          {/* G as a dot (the G dial already shows it without the adapter). */}
          {d.mode === 'adapter' && d.g ? <GDot g={d.g} accent={accent} /> : null}
        </View>
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
  info: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 12, rowGap: 2, marginTop: 8},
  infoItem: {flexDirection: 'row', alignItems: 'center', gap: 4},
  infoText: {color: CLUSTER_INK.textDim, fontFamily: FONT.bold, fontSize: 12, fontVariant: ['tabular-nums']},
  topLine: {position: 'absolute', top: 6, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 16},
  topText: {color: CLUSTER_INK.textDim, fontFamily: FONT.extrabold, fontSize: 12, fontVariant: ['tabular-nums']},
  gearRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  shift: {flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 8, paddingHorizontal: 7, height: 24, borderRadius: 7, backgroundColor: 'rgba(52,224,122,0.14)'},
  shiftText: {color: CLUSTER_INK.green, fontFamily: FONT.black, fontSize: 14},
  stripSide: {flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1},
  stripRight: {justifyContent: 'flex-end'},
  gapLeft: {marginLeft: 6},
  stripText: {color: CLUSTER_INK.textDim, fontFamily: FONT.bold, fontSize: 12, fontVariant: ['tabular-nums']},
  limit: {width: 30, height: 30, borderRadius: 15, borderWidth: 3, borderColor: CLUSTER_INK.red, backgroundColor: CLUSTER_INK.text, alignItems: 'center', justifyContent: 'center'},
  limitText: {color: CLUSTER_INK.onSwatch, fontFamily: FONT.black, fontSize: 11, fontVariant: ['tabular-nums']},
  gRing: {width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: CLUSTER_INK.tick, alignItems: 'center', justifyContent: 'center'},
  gDot: {width: 7, height: 7, borderRadius: 4, shadowOpacity: 0.9, shadowRadius: 4, shadowOffset: {width: 0, height: 0}},
  gear: {marginTop: 8, minWidth: 34, height: 28, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8},
  gearText: {fontFamily: FONT.black, fontSize: 17},
  strip: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18},
  lamps: {flexDirection: 'row', alignItems: 'center', gap: 14},
  lamp: {shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: {width: 0, height: 0}},
  state: {color: CLUSTER_INK.textDim, fontFamily: FONT.extrabold, fontSize: 11, letterSpacing: 1.5},
  clock: {color: CLUSTER_INK.text, fontFamily: FONT.extrabold, fontSize: 15, fontVariant: ['tabular-nums']},
});
