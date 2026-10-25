import {BlurMask, Canvas, Circle, Group, Line, Path, rect, rrect, Skia, vec} from '@shopify/react-native-skia';
import {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Animated, {useAnimatedStyle, useDerivedValue, type SharedValue} from 'react-native-reanimated';
import {useAppTheme} from '../../theme/ThemeProvider';
import {arcPath, GAUGE_START_DEG} from '../../utils/gaugeMath';
import {angleOf, pointAt} from './gaugeMotion';

/**
 * Two dial faces on `GaugeDial`'s 200 × 200 grid, drawn with Skia: HUD (aviation speed tape) and
 * Neon (glowing arc). The speed number is laid over them by `GaugeDial`.
 */

const END_DEG = GAUGE_START_DEG + 270;

const TAPE_PX = 2.2;
const TAPE = {x: 10, y: 114, w: 180, h: 52};

/** Aviation speed tape: the scale glides under a fixed pointer; the number sits above it. */
export function TapeFace({value, scale, unit, accent, size}: {value: SharedValue<number>; scale: number; unit: string; accent: string; size: number}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const k = size / 200;
  // Every tick from 0 past full scale, laid out once; the whole strip slides with the speed.
  const ticks = useMemo(() => Array.from({length: Math.ceil((scale + 60) / 5) + 1}, (_, i) => i * 5), [scale]);
  const slide = useDerivedValue(() => [{translateX: -value.value * TAPE_PX}]);
  const labelSlide = useAnimatedStyle(() => ({transform: [{translateX: -value.value * TAPE_PX * k}]}));
  const pointer = useMemo(() => {
    const p = Skia.Path.Make();
    p.moveTo(92, 104);
    p.lineTo(108, 104);
    p.lineTo(100, 114);
    p.close();
    return p;
  }, []);
  const box = useMemo(() => rrect(rect(TAPE.x, TAPE.y, TAPE.w, TAPE.h), 14, 14), []);
  const boxPath = useMemo(() => Skia.Path.Make().addRRect(box), [box]);

  return (
    <>
      <Canvas style={StyleSheet.absoluteFill}>
        <Group transform={[{scale: k}]}>
          <Path path={boxPath} color={c.card} opacity={0.6} />
          <Path path={boxPath} style="stroke" strokeWidth={1.5} color={c.separator} />
          <Group clip={box}>
            <Group transform={slide}>
              {ticks.map((v) => {
                const x = 100 + v * TAPE_PX;
                const major = v % 20 === 0;
                return <Line key={v} p1={vec(x, TAPE.y)} p2={vec(x, major ? 134 : 124)} color={c.textSecondary} opacity={major ? 0.9 : 0.45} strokeWidth={major ? 2.2 : 1.4} />;
              })}
            </Group>
          </Group>
          <Path path={pointer} color={accent} />
          <Line p1={vec(100, TAPE.y)} p2={vec(100, 140)} color={accent} strokeWidth={2.6} />
        </Group>
      </Canvas>
      <Text style={[styles.centred, {top: 22 * k, fontSize: 12 * k, fontFamily: theme.font.extrabold, color: c.textSecondary, letterSpacing: 1}]}>{unit.toUpperCase()}</Text>
      {/* The tape's numbers, sliding with it inside the tape's window. */}
      <View pointerEvents="none" style={[styles.window, {left: TAPE.x * k, top: TAPE.y * k, width: TAPE.w * k, height: TAPE.h * k, borderRadius: 14 * k}]}>
        <Animated.View style={[StyleSheet.absoluteFill, labelSlide]}>
          {ticks
            .filter((v) => v % 20 === 0)
            .map((v) => (
              <Text key={v} style={[styles.tapeLabel, {left: (100 + v * TAPE_PX - TAPE.x - 15) * k, top: (156 - TAPE.y - 12 * 0.98) * k, width: 30 * k, fontSize: 12 * k, fontFamily: theme.font.extrabold, color: c.textSecondary}]}>
                {v}
              </Text>
            ))}
        </Animated.View>
      </View>
    </>
  );
}

function Dot({i, share, accent}: {i: number; share: SharedValue<number>; accent: string}) {
  const p = pointAt(97, GAUGE_START_DEG + 27 * i);
  const opacity = useDerivedValue(() => (share.value * 10 >= i ? 0.9 : 0.25));
  return <Circle cx={p.x} cy={p.y} r={1.6} color={accent} opacity={opacity} />;
}

/** Synthwave neon: the accent arc glows through layered blurs, brightest at its tip. */
export function NeonFace({share, accent, unit, size}: {share: SharedValue<number>; accent: string; unit: string; size: number}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const k = size / 200;
  const arc = useMemo(() => Skia.Path.MakeFromSVGString(arcPath(100, 100, 82, GAUGE_START_DEG, END_DEG))!, []);
  const tip = useDerivedValue(() => pointAt(82, angleOf(share.value)));
  const tipX = useDerivedValue(() => tip.value.x);
  const tipY = useDerivedValue(() => tip.value.y);
  const tipOpacity = useDerivedValue(() => (share.value > 0.002 ? 1 : 0));
  return (
    <>
      <Canvas style={StyleSheet.absoluteFill}>
        <Group transform={[{scale: k}]}>
          {Array.from({length: 11}, (_, i) => (
            <Dot key={i} i={i} share={share} accent={accent} />
          ))}
          <Path path={arc} style="stroke" strokeWidth={6} strokeCap="round" color={accent} opacity={0.14} />
          <Path path={arc} start={0} end={share} style="stroke" strokeWidth={30} strokeCap="round" color={accent} opacity={0.12}>
            <BlurMask blur={12} style="normal" />
          </Path>
          <Path path={arc} start={0} end={share} style="stroke" strokeWidth={16} strokeCap="round" color={accent} opacity={0.35}>
            <BlurMask blur={6} style="normal" />
          </Path>
          <Path path={arc} start={0} end={share} style="stroke" strokeWidth={6} strokeCap="round" color={accent} />
          <Group opacity={tipOpacity}>
            <Circle cx={tipX} cy={tipY} r={14} color={accent} opacity={0.3}>
              <BlurMask blur={6} style="normal" />
            </Circle>
            <Circle cx={tipX} cy={tipY} r={6} color={c.onAccent} />
          </Group>
        </Group>
      </Canvas>
      <Text style={[styles.centred, {top: 127 * k, fontSize: 13 * k, fontFamily: theme.font.bold, color: accent}]}>{unit}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  centred: {position: 'absolute', left: 0, right: 0, textAlign: 'center'},
  window: {position: 'absolute', overflow: 'hidden'},
  tapeLabel: {position: 'absolute', textAlign: 'center'},
});
