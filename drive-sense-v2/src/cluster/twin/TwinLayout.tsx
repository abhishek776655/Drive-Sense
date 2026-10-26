import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useUnits } from '../../hooks/useUnits';
import { FONT } from '../../theme/theme';
import { economy, fuelFlowUnits, powerUnits, temperature, torqueUnits } from '../../obd/tiles';
import { useObdStore, type HistoryPoint } from '../../stores/obdStore';
import { TraceDial } from '../parts/TraceDial';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { kmhInUnits } from '../../utils/units';
import { CAR_DIAL_NAMES, CLUSTER_INK, DIAL_STYLE_NAMES, DIAL_STYLES, DIAL_VIEWS, isCarDial, PHONE_DIAL_NAMES, PHONE_DIALS, type CarDial, type DialView, type PhoneDial } from '../accents';
import type { ClusterData } from '../clusterData';
import { dialMax, fuelDialHead, gPoint, redlineHeat } from '../motion';
import { ArcDial } from '../parts/ArcDial';
import { BarGauge } from '../parts/BarGauge';
import { CentrePager } from '../parts/CentrePager';
import { ClimbDial } from '../parts/ClimbDial';
import { CompassDial } from '../parts/CompassDial';
import { GDial } from '../parts/GDial';
import { SpeedGraphDial } from '../parts/SpeedGraphDial';
import { usePhoneTrace } from '../usePhoneTrace';
import { LoadBars } from '../parts/LoadBars';
import { LoadMeter } from '../parts/LoadMeter';
import { MapPage } from '../parts/MapPage';
import { CarPage, TripPage } from '../parts/pages';
import { AllTimePage, DrivingTotalsPage, EngineGraphPage, GraphPage } from '../parts/statPages';
import { VerticalPager } from '../parts/VerticalPager';

const STRIP_H = 36;
/** Names shown when a dial is swiped to another view (its own gauge is named per dial). */
const VIEW_NAMES: Record<Exclude<DialView, 'main'>, string> = { ...PHONE_DIAL_NAMES, ...CAR_DIAL_NAMES };
const COOLANT_RANGE = [40, 130];
// Stable, so the engine graphs don't redraw their paths on every render.
const pickPower = (p: HistoryPoint) => p.power;
const pickTorque = (p: HistoryPoint) => p.torque;

/** Local time, refreshed each minute, for the strip. */
function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** A warning lamp in the strip: lit amber or red, otherwise not drawn. */
function Lamp({ icon, color }: { icon: keyof typeof Ionicons.glyphMap; color: string }) {
  return (
    <View style={[styles.lamp, { shadowColor: color }]}>
      <Ionicons name={icon} size={17} color={color} />
    </View>
  );
}

/** Small readouts inside a dial, under its number: an icon and a value each. */
function DialInfo({ items, maxWidth, onPaper }: { items: { icon: keyof typeof Ionicons.glyphMap; text: string | null; warn?: boolean }[]; maxWidth?: number; onPaper?: boolean }) {
  // On the Classic dial's white face the readouts are printed in dark ink.
  const ink = onPaper ? CLUSTER_INK.inkDim : CLUSTER_INK.textDim;
  const shown = items.filter((i) => i.text != null);
  if (shown.length === 0) {
    return null;
  }
  return (
    <View style={[styles.info, maxWidth != null && { maxWidth }]}>
      {shown.map((i) => (
        <View key={i.icon} style={styles.infoItem}>
          <Ionicons name={i.icon} size={13} color={i.warn ? CLUSTER_INK.amber : ink} />
          <Text style={[styles.infoText, { color: ink }, i.warn && { color: CLUSTER_INK.amber }]}>{i.text}</Text>
        </View>
      ))}
    </View>
  );
}

/** G-force as a dot in a small ring: up speeding up, down braking, sideways cornering. */
function GDot({ g, accent }: { g: { lon: number; lat: number }; accent: string }) {
  const p = gPoint(g, 9);
  return (
    <View style={styles.gRing} accessibilityLabel="G-force">
      <View style={[styles.gDot, { backgroundColor: accent, shadowColor: accent, transform: [{ translateX: p.x }, { translateY: p.y }] }]} />
    </View>
  );
}

/** One way a dial can be swiped through: its options, their names, the current one and what to do on a change. */
type SwipeAxis = { options: readonly string[]; names: Record<string, string>; value: string; onSwitch: (next: string) => void };
const swipeAxis = <T extends string>(options: readonly T[], names: Record<T, string>, value: T, onSwitch: (next: T) => void): SwipeAxis => ({
  options,
  names,
  value,
  onSwitch: (next) => onSwitch(next as T),
});

/**
 * A dial that rolls to its next option when swiped, turning like a wheel: up or down through its
 * styles (`vertical`), left or right through what it shows (`horizontal`). The old face rolls away
 * in the swipe's direction and the next rolls in, with a light tick and its name shown briefly.
 */
function DialSwitch({ style, size, vertical, horizontal, children }: { style: ViewStyle; size: number; vertical?: SwipeAxis; horizontal?: SwipeAxis; children: ReactNode }) {
  const label = useSharedValue(0);
  const rollX = useSharedValue(0);
  const rollY = useSharedValue(0);
  const [name, setName] = useState<string | null>(null);
  // Halfway through the roll (old face out of sight), swap in the next one and roll it in.
  const swapIn = (across: boolean, next: string, dir: number) => {
    const axis = across ? horizontal : vertical;
    if (!axis) {
      return;
    }
    axis.onSwitch(next);
    setName(axis.names[next]);
    (across ? rollX : rollY).set(withSequence(withTiming(-dir, { duration: 0 }), withSpring(0, { dampingRatio: 0.8, duration: 450 })));
    label.set(withSequence(withTiming(1, { duration: 150 }), withDelay(900, withTiming(0, { duration: 400 }))));
  };
  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-18, 18])
    .activeOffsetY([-18, 18])
    .onEnd((e) => {
      const across = Math.abs(e.translationX) > Math.abs(e.translationY);
      const axis = across ? horizontal : vertical;
      if (!axis || axis.options.length < 2) {
        return;
      }
      // Swiping up or left moves on to the next option.
      const forward = across ? e.translationX < 0 : e.translationY < 0;
      const dir = forward ? -1 : 1;
      const i = axis.options.indexOf(axis.value);
      const next = axis.options[(i + (forward ? 1 : axis.options.length - 1)) % axis.options.length];
      void Haptics.selectionAsync().catch(() => undefined);
      (across ? rollX : rollY).set(
        withTiming(dir, { duration: 170, easing: Easing.in(Easing.quad) }, (done) => {
          if (done) {
            runOnJS(swapIn)(across, next, dir);
          }
        }),
      );
    });
  const rollStyle = useAnimatedStyle(() => {
    const away = Math.min(1, Math.max(Math.abs(rollX.value), Math.abs(rollY.value)));
    return {
      opacity: 1 - away,
      transform: [
        { perspective: 900 },
        { translateX: rollX.value * size * 0.22 },
        { translateY: rollY.value * size * 0.22 },
        { rotateY: `${rollX.value * 40}deg` },
        { rotateX: `${-rollY.value * 40}deg` },
        { scale: 1 - away * 0.1 },
      ],
    };
  });
  const labelStyle = useAnimatedStyle(() => ({ opacity: label.value, transform: [{ translateY: (1 - label.value) * 6 }] }));
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
export function TwinLayout({ d, width, height, accent }: { d: ClusterData; width: number; height: number; accent: string }) {
  const u = useUnits();
  const clock = useClock();
  const tempUnit = usePreferencesStore((s) => s.temperature);
  const mileage = usePreferencesStore((s) => s.mileageUnit);
  const speedStyle = usePreferencesStore((s) => s.clusterSpeedDial);
  const revStyle = usePreferencesStore((s) => s.clusterRevDial);
  const phoneDial = usePreferencesStore((s) => s.clusterPhoneDial);
  const leftView = usePreferencesStore((s) => s.clusterLeftView);
  const rightView = usePreferencesStore((s) => s.clusterRightView);
  // The phone's compass only runs while a dial is showing it.
  const trace = usePhoneTrace(leftView === 'compass' || (d.mode === 'adapter' ? rightView === 'compass' : phoneDial === 'compass'));
  const setPrefs = usePreferencesStore((s) => s.set);
  const rowH = height - STRIP_H;
  // Big dials that reach into the centre; the centre sits behind them and fades out under their rims.
  const dial = Math.min(rowH * 0.94, width * 0.38);
  const overlap = dial * 0.11;
  // The centre takes a little less than the room between the dials (85%), and the dials close in by as much.
  const panelW = Math.max(200, (width - dial * 2 + overlap * 2) * 0.85);
  const groupX = (width - (dial * 2 + panelW - overlap * 2)) / 2;
  const panelH = rowH * 0.86;
  // The centre layer runs on under the dials by this much; only the map uses it, other pages are
  // padded back to the visible gap.
  const under = dial * 0.28;
  const layerW = panelW + under * 2;
  const fadeW = under + overlap + 40;
  // The centre clear of the dial rims, with half the edge fade allowed (the load meter keeps to it).
  const clearW = panelW - overlap * 2 - 40;
  const imperial = u.units === 'imperial';
  const speed = d.speedKmh == null ? null : kmhInUnits(d.speedKmh, u.units);
  const speedMax = dialMax(imperial ? 140 : 220, 20, speed);
  const range = d.rangeKm != null ? `${Math.round(u.distanceValue(d.rangeKm * 1000) ?? 0)} ${u.distanceUnit}` : null;
  const instant = d.instantL100km != null ? economy(d.instantL100km, u.units, mileage) : null;
  const coolant = d.coolantC != null ? temperature(d.coolantC, tempUnit) : null;

  const power = d.powerKw != null ? powerUnits(d.powerKw, u.units) : null;
  const torque = d.torqueNm != null ? torqueUnits(d.torqueNm, u.units) : null;
  // Power and torque, one graph each, swiping up from the CAR page.
  const engineGraphs = [
    {
      key: 'power',
      node: (
        <EngineGraphPage
          title="POWER"
          value={power?.value ?? '–'}
          unit={powerUnits(0, u.units).unit}
          peak={(top) => `Peak ${powerUnits(top, u.units).value} ${powerUnits(0, u.units).unit}`}
          pick={pickPower}
          step={10}
          clearWidth={clearW}
          color={accent}
        />
      ),
    },
    {
      key: 'torque',
      node: (
        <EngineGraphPage
          title="TORQUE"
          value={torque?.value ?? '–'}
          unit={torqueUnits(0, u.units).unit}
          peak={(top) => `Peak ${torqueUnits(top, u.units).value} ${torqueUnits(0, u.units).unit}`}
          pick={pickTorque}
          step={50}
          clearWidth={clearW}
          color={accent}
        />
      ),
    },
  ];
  const history = useObdStore((s) => s.history);
  const flowLph = useObdStore((s) => s.derived.fuelFlow);
  const inset = (node: ReactNode) => <View style={{ flex: 1, paddingHorizontal: under }}>{node}</View>;
  // Trip and Engine each have more views, a swipe up or down away.
  const pages = [
    {
      key: 'trip',
      node: inset(
        <VerticalPager
          height={panelH}
          accent={accent}
          views={[
            { key: 'drive', node: <TripPage d={d} /> },
            { key: 'totals', node: <DrivingTotalsPage /> },
            { key: 'graph', node: <GraphPage width={panelW} accent={accent} /> },
          ]}
        />,
      ),
    },
  ];
  if (d.mode === 'adapter') {
    const engine = { loadPct: d.loadPct, throttlePct: d.throttlePct, coasting: d.coasting, boostKpa: d.boostKpa, accent };
    pages.push({
      key: 'engine',
      node: inset(
        <VerticalPager
          height={panelH}
          accent={accent}
          views={[
            { key: 'arc', node: <LoadMeter width={panelW} height={panelH - 14} clearWidth={clearW} {...engine} /> },
            { key: 'bars', node: <LoadBars width={panelW} height={panelH - 30} vertical={false} {...engine} /> },
            { key: 'columns', node: <LoadBars width={panelW} height={panelH - 30} vertical {...engine} /> },
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
            { key: 'now', node: <CarPage d={d} /> },
            // Power and torque, one swipe up, for cars that report torque.
            ...(d.powerKw != null || d.torqueNm != null ? engineGraphs : []),
            { key: 'all', node: <AllTimePage /> },
          ]}
        />,
      ),
    });
  }
  pages.push({ key: 'map', node: <MapPage accent={accent} /> });

  const coolantShare = d.coolantC == null ? null : Math.min(1, Math.max(0, (d.coolantC - COOLANT_RANGE[0]) / (COOLANT_RANGE[1] - COOLANT_RANGE[0])));
  const outside = d.outsideC != null ? temperature(d.outsideC, tempUnit) : null;
  const fuelColor = d.alerts.lowFuel ? CLUSTER_INK.amber : accent;
  // The bar shows no figure of its own: percent (and range, when known) beside it.
  const fuelCaption = d.fuelGaugePct == null ? null : `${Math.round(d.fuelGaugePct)}%${range ? ` · ${range}` : ''}`;
  const coolantColor = d.alerts.hotCoolant ? CLUSTER_INK.red : accent;
  const dialTop = (rowH - dial) / 2;
  const stateLabel = d.carState === 'engineOff' ? 'ENGINE OFF' : d.carState === 'parked' ? 'PARKED' : null;

  const speedGauge = (
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
          onPaper={speedStyle === 'classic'}
          // Needle styles keep them in the narrow space between the bottom scale labels.
          maxWidth={speedStyle === 'needle' || speedStyle === 'classic' ? dial * 0.34 : undefined}
          items={[
            // This drive's distance while recording, else how far the tank goes.
            d.distanceM != null ? { icon: 'navigate-circle', text: `${u.distance(d.distanceM)} ${u.distanceUnit}` } : { icon: 'color-fill', text: range, warn: d.alerts.lowFuel },
            { icon: 'leaf', text: instant ? `${instant.value} ${instant.unit}` : null },
          ]}
        />
      }
    />
  );
  const rpmGauge = (
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
            <View style={[styles.gear, { borderColor: d.gear ? accent : revStyle === 'classic' ? CLUSTER_INK.inkFaint : CLUSTER_INK.textFaint }]}>
              <Text style={[styles.gearText, { color: d.gear ? accent : revStyle === 'classic' ? CLUSTER_INK.inkFaint : CLUSTER_INK.textFaint }]}>{d.gear ?? '–'}</Text>
            </View>
            {/* Shift-up hint: high revs in a low gear. */}
            {d.shiftUp ? (
              <View style={styles.shift}>
                <Ionicons name="arrow-up" size={13} color={CLUSTER_INK.green} />
                <Text style={styles.shiftText}>{d.shiftUp}</Text>
              </View>
            ) : null}
          </View>
          <DialInfo onPaper={revStyle === 'classic'} items={[{ icon: 'speedometer', text: d.loadPct != null ? `${Math.round(d.loadPct)}%` : null }]} />
        </>
      }
    />
  );
  // The phone's own views, which either dial can show instead of its gauge.
  const phoneView = (view: PhoneDial) =>
    view === 'climb' ? (
      <ClimbDial size={dial} accent={accent} altitudeM={trace.altitudeM} gradePct={trace.gradePct} />
    ) : view === 'compass' ? (
      <CompassDial size={dial} accent={accent} headingDeg={trace.headingDeg} />
    ) : view === 'speed' ? (
      <SpeedGraphDial size={dial} accent={accent} trace={trace.speed} />
    ) : (
      <GDial size={dial} g={d.g} accent={accent} />
    );
  // The car's own views (power and torque, fuel use), from the adapter's last minute.
  const carView = (view: CarDial) => {
    const at = (pick: (p: HistoryPoint) => number | null) => history.flatMap((p) => (pick(p) == null ? [] : [{ at: p.at, v: pick(p) as number }]));
    if (view === 'power') {
      const peakKw = Math.max(0, ...history.map((p) => p.power ?? 0));
      return (
        <TraceDial
          size={dial}
          caption="POWER"
          value={power?.value ?? '–'}
          unit={powerUnits(0, u.units).unit}
          lines={[
            { points: at(pickPower), color: accent, main: true },
            { points: at(pickTorque), color: CLUSTER_INK.textDim },
          ]}
          foot={[
            { label: 'torque', value: torque ? `${torque.value} ${torque.unit}` : '–' },
            { label: 'peak', value: peakKw > 0 ? powerUnits(peakKw, u.units).value : '–' },
          ]}
        />
      );
    }
    const head = fuelDialHead(d.instantL100km, flowLph, u.units, mileage);
    const driveEconomy = d.driveL100km != null ? economy(d.driveL100km, u.units, mileage) : null;
    return (
      <TraceDial
        size={dial}
        caption={head.caption}
        value={head.value}
        unit={head.unit}
        lines={[{ points: at((p) => p.fuelFlow), color: accent, main: true }]}
        foot={[
          { label: 'flow', value: flowLph != null ? `${fuelFlowUnits(flowLph, u.units).value} ${fuelFlowUnits(0, u.units).unit}` : '–' },
          { label: 'drive', value: driveEconomy ? `${driveEconomy.value} ${driveEconomy.unit}` : '–' },
        ]}
      />
    );
  };
  // Car views need the car: without it a dial left on one falls back to its own gauge.
  const adapter = d.mode === 'adapter';
  const views = adapter ? DIAL_VIEWS : DIAL_VIEWS.filter((v) => !isCarDial(v));
  const leftShown: DialView = !adapter && isCarDial(leftView) ? 'main' : leftView;
  const dialView = (view: Exclude<DialView, 'main'>) => (isCarDial(view) ? carView(view) : phoneView(view));

  return (
    <View style={{ width, height }}>
      <View style={{ height: rowH }}>
        <View style={[styles.centre, { left: (width - layerW) / 2, top: (rowH - panelH) / 2 + rowH * 0.06, width: layerW, height: panelH }]}>
          <CentrePager pages={pages} width={layerW} height={panelH - 10} accent={accent} />
          <LinearGradient pointerEvents="none" colors={[CLUSTER_INK.background, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fade, { left: 0, width: fadeW }]} />
          <LinearGradient pointerEvents="none" colors={['transparent', CLUSTER_INK.background]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fade, { right: 0, width: fadeW }]} />
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
        <DialSwitch
          style={{ ...styles.dial, left: groupX, top: dialTop }}
          size={dial}
          vertical={leftShown === 'main' ? swipeAxis(DIAL_STYLES, DIAL_STYLE_NAMES, speedStyle, (next) => void setPrefs({ clusterSpeedDial: next })) : undefined}
          horizontal={swipeAxis(views, { ...VIEW_NAMES, main: 'Speed' }, leftShown, (next) => void setPrefs({ clusterLeftView: next }))}>
          {leftShown === 'main' ? speedGauge : dialView(leftShown)}
        </DialSwitch>
        {d.mode === 'adapter' ? (
          <DialSwitch
            style={{ ...styles.dial, right: groupX, top: dialTop }}
            size={dial}
            vertical={rightView === 'main' ? swipeAxis(DIAL_STYLES, DIAL_STYLE_NAMES, revStyle, (next) => void setPrefs({ clusterRevDial: next })) : undefined}
            horizontal={swipeAxis(DIAL_VIEWS, { ...VIEW_NAMES, main: 'RPM' }, rightView, (next) => void setPrefs({ clusterRightView: next }))}>
            {rightView === 'main' ? rpmGauge : dialView(rightView)}
          </DialSwitch>
        ) : (
          // Without the adapter there is no RPM: the right dial rolls between the phone views either way.
          <DialSwitch
            style={{ ...styles.dial, right: groupX, top: dialTop }}
            size={dial}
            vertical={swipeAxis(PHONE_DIALS, PHONE_DIAL_NAMES, phoneDial, (next) => void setPrefs({ clusterPhoneDial: next }))}
            horizontal={swipeAxis(PHONE_DIALS, PHONE_DIAL_NAMES, phoneDial, (next) => void setPrefs({ clusterPhoneDial: next }))}>
            {phoneView(phoneDial)}
          </DialSwitch>
        )}
      </View>
      <View style={[styles.strip, { height: STRIP_H }]}>
        <View style={styles.stripSide}>
          {/* Engine temperature as a bar along the bottom, mirroring fuel on the right. */}
          {coolant ? <BarGauge icon="thermometer" share={coolantShare} color={coolantColor} caption={`${coolant.value}${coolant.unit}`} value={null} variant="bar" /> : null}
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
          {/* Fuel is always a bar along the bottom, in either mode: the last reading holds with the car off. */}
          {d.fuelGaugePct != null ? (
            <BarGauge icon="color-fill" share={d.fuelGaugePct / 100} color={fuelColor} caption={fuelCaption} value={null} variant="bar" align="right" />
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
  centre: { position: 'absolute', overflow: 'hidden' },
  fade: { position: 'absolute', top: 0, bottom: 0 },
  dial: { position: 'absolute' },
  switchLabel: { position: 'absolute', left: 0, right: 0, bottom: '9%', alignItems: 'center' },
  switchText: { color: CLUSTER_INK.text, fontFamily: FONT.extrabold, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' },
  info: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 12, rowGap: 2, marginTop: 8 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoText: { color: CLUSTER_INK.textDim, fontFamily: FONT.bold, fontSize: 12, fontVariant: ['tabular-nums'] },
  topLine: { position: 'absolute', top: 6, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 16 },
  topText: { color: CLUSTER_INK.textDim, fontFamily: FONT.extrabold, fontSize: 12, fontVariant: ['tabular-nums'] },
  gearRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shift: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 8, paddingHorizontal: 7, height: 24, borderRadius: 7, backgroundColor: 'rgba(52,224,122,0.14)' },
  shiftText: { color: CLUSTER_INK.green, fontFamily: FONT.black, fontSize: 14 },
  stripSide: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  stripRight: { justifyContent: 'flex-end' },
  gapLeft: { marginLeft: 6 },
  stripText: { color: CLUSTER_INK.textDim, fontFamily: FONT.bold, fontSize: 12, fontVariant: ['tabular-nums'] },
  limit: { width: 30, height: 30, borderRadius: 15, borderWidth: 3, borderColor: CLUSTER_INK.red, backgroundColor: CLUSTER_INK.text, alignItems: 'center', justifyContent: 'center' },
  limitText: { color: CLUSTER_INK.onSwatch, fontFamily: FONT.black, fontSize: 11, fontVariant: ['tabular-nums'] },
  gRing: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: CLUSTER_INK.tick, alignItems: 'center', justifyContent: 'center' },
  gDot: { width: 7, height: 7, borderRadius: 4, shadowOpacity: 0.9, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  gear: { marginTop: 8, minWidth: 34, height: 28, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  gearText: { fontFamily: FONT.black, fontSize: 17 },
  strip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  lamps: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  lamp: { shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  state: { color: CLUSTER_INK.textDim, fontFamily: FONT.extrabold, fontSize: 11, letterSpacing: 1.5 },
  clock: { color: CLUSTER_INK.text, fontFamily: FONT.extrabold, fontSize: 15, fontVariant: ['tabular-nums'] },
});
