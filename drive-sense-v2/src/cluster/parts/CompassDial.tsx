import {BlurMask, Canvas, Line, Path, Skia, vec} from '@shopify/react-native-skia';
import {useEffect, useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Animated, {useAnimatedStyle, useSharedValue, withSpring} from 'react-native-reanimated';
import {FONT} from '../../theme/theme';
import {CLUSTER_INK} from '../accents';
import {compassPoint, polar} from '../motion';
import {DialFace} from './DialFace';

const LETTERS: {deg: number; text: string; main: boolean}[] = [
  {deg: 0, text: 'N', main: true},
  {deg: 45, text: 'NE', main: false},
  {deg: 90, text: 'E', main: true},
  {deg: 135, text: 'SE', main: false},
  {deg: 180, text: 'S', main: true},
  {deg: 225, text: 'SW', main: false},
  {deg: 270, text: 'W', main: true},
  {deg: 315, text: 'NW', main: false},
];

/** Skia angles start at 3 o'clock; compass bearings at 12. */
const bearing = (deg: number) => deg - 90;

/**
 * Compass (phone dial): a full compass rose that turns so the way the car is heading is always at
 * the top under a fixed glowing marker, with the bearing and its compass point in the middle.
 */
export function CompassDial({size, accent, headingDeg}: {size: number; accent: string; headingDeg: number | null}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 22;

  // Turn the short way round: 350° → 10° is +20°, not −340°.
  const turn = useSharedValue(headingDeg != null ? -headingDeg : 0);
  useEffect(() => {
    if (headingDeg == null) {
      return;
    }
    const target = -headingDeg;
    const delta = ((((target - turn.value) % 360) + 540) % 360) - 180;
    turn.set(withSpring(turn.value + delta, {dampingRatio: 0.9, duration: 700}));
  }, [headingDeg, turn]);
  const roseStyle = useAnimatedStyle(() => ({transform: [{rotate: `${turn.value}deg`}]}));

  const marker = useMemo(() => {
    const p = Skia.Path.Make();
    p.moveTo(cx, cy - r - 4);
    p.lineTo(cx - 8, cy - r - 18);
    p.lineTo(cx + 8, cy - r - 18);
    p.close();
    return p;
  }, [cx, cy, r]);

  const ticks = Array.from({length: 72}, (_, i) => i * 5);
  const labelR = r - 34;

  return (
    <View style={{width: size, height: size}}>
      <Canvas style={StyleSheet.absoluteFill}>
        <DialFace cx={cx} cy={cy} r={r} />
      </Canvas>
      <Animated.View style={[StyleSheet.absoluteFill, roseStyle]}>
        <Canvas style={StyleSheet.absoluteFill}>
          {ticks.map((t) => {
            const major = t % 30 === 0;
            const a = polar(cx, cy, r - 4, bearing(t));
            const b = polar(cx, cy, r - (major ? 18 : t % 10 === 0 ? 12 : 8), bearing(t));
            return <Line key={t} p1={vec(a.x, a.y)} p2={vec(b.x, b.y)} color={t === 0 ? CLUSTER_INK.red : major ? CLUSTER_INK.text : CLUSTER_INK.tick} strokeWidth={major ? 2.2 : 1} strokeCap="round" />;
          })}
        </Canvas>
        {LETTERS.map((l) => {
          const p = polar(cx, cy, labelR, bearing(l.deg));
          return (
            // Each letter turns with the rose, so it reads upright when it reaches the top.
            <Text key={l.text} style={[styles.letter, l.main ? styles.main : styles.minor, l.deg === 0 && {color: CLUSTER_INK.red}, {left: p.x - 20, top: p.y - 11, transform: [{rotate: `${l.deg}deg`}]}]}>
              {l.text}
            </Text>
          );
        })}
      </Animated.View>
      {/* The fixed marker over the heading. */}
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Path path={marker} color={accent} opacity={0.6}>
          <BlurMask blur={6} style="normal" />
        </Path>
        <Path path={marker} color={accent} />
      </Canvas>
      <View style={[StyleSheet.absoluteFill, styles.centre]} pointerEvents="none">
        <Text style={[styles.number, {fontSize: size * 0.15}]}>{headingDeg == null ? '–' : `${Math.round(headingDeg) % 360}°`}</Text>
        <Text style={[styles.point, {color: accent}]}>{compassPoint(headingDeg) ?? 'NO HEADING'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: {alignItems: 'center', justifyContent: 'center'},
  letter: {position: 'absolute', width: 40, textAlign: 'center', fontFamily: FONT.black},
  main: {color: CLUSTER_INK.text, fontSize: 18},
  minor: {color: CLUSTER_INK.textDim, fontSize: 11, marginTop: 3},
  number: {color: CLUSTER_INK.text, fontFamily: FONT.black, fontVariant: ['tabular-nums'], letterSpacing: -1},
  point: {fontFamily: FONT.extrabold, fontSize: 14, letterSpacing: 2, marginTop: -2},
});
