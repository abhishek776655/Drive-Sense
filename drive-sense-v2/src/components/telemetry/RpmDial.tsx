import {MaterialCommunityIcons} from '@expo/vector-icons';
import {BlurMask, Canvas, Circle, Line, Path, Skia, SweepGradient, vec} from '@shopify/react-native-skia';
import {useEffect, useMemo} from 'react';
import {View} from 'react-native';
import {Easing, useDerivedValue, useSharedValue, withSequence, withSpring, withTiming, type SharedValue} from 'react-native-reanimated';
import {angleAt, arcPath, dialMax, fraction, polar, ticks} from '../../cluster/motion';
import {withAlpha} from '../../theme/color';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {Card} from '../Card';
import {useReduceMotion} from '../onboarding/motion';

const SIZE = 250;
const STROKE = 14;
const CX = SIZE / 2;
const CY = SIZE / 2;
// Room outside the arc for its glow, which the canvas would otherwise clip.
const R = SIZE / 2 - STROKE - 12;

/** A tick inside the arc: faint, and lit in the accent once the arc reaches it. */
function Tick({share, major, progress, lit, dim}: {share: number; major: boolean; progress: SharedValue<number>; lit: string; dim: string}) {
  const deg = angleAt(share);
  const outer = polar(CX, CY, R - STROKE, deg);
  const inner = polar(CX, CY, R - STROKE - (major ? 10 : 5), deg);
  const color = useDerivedValue(() => (progress.value >= share - 0.002 ? lit : dim));
  return <Line p1={vec(outer.x, outer.y)} p2={vec(inner.x, inner.y)} color={color} strokeWidth={major ? 2 : 1} strokeCap="round" />;
}

/** Parking or gear: lit in the accent when it is the car's state, faint otherwise. */
function ShiftChip({icon, label, on}: {icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string | null; on: boolean}) {
  const c = useAppTheme().colors;
  const color = on ? c.accent : c.textTertiary;
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingHorizontal: label ? 10 : 7, borderRadius: 14, backgroundColor: on ? c.accentTint : withAlpha(c.textPrimary, 0.06)}}>
      <MaterialCommunityIcons name={icon} size={16} color={color} />
      {label ? (
        <AppText size={14} weight="black" color={color} style={{fontVariant: ['tabular-nums']}}>
          {label}
        </AppText>
      ) : null}
    </View>
  );
}

/**
 * The Telemetry hero: RPM on a glowing arc that springs to the value (a sweep up and back when it
 * first appears), ticks that light as it passes, the redline band, speed big in the middle, and
 * under the RPM whether the car is parked or in which (guessed) gear.
 */
export function RpmDial({rpm, speed, speedUnit, gear, parked, redline}: {rpm: number | null; speed: string; speedUnit: string; gear: string | null; parked: boolean; redline: number}) {
  const c = useAppTheme().colors;
  const reduce = useReduceMotion();
  const max = dialMax(8000, 1000, rpm);
  const hot = (rpm ?? 0) >= redline;
  const target = fraction(rpm, max);

  const progress = useSharedValue(0);
  const goal = useSharedValue(target);
  const ready = useSharedValue(reduce);
  useEffect(() => {
    if (reduce) {
      return;
    }
    const ease = Easing.inOut(Easing.cubic);
    // Opening sweep up and back, then on to whatever the value is by then.
    progress.set(
      withSequence(
        withTiming(1, {duration: 550, easing: ease}),
        withTiming(0, {duration: 550, easing: ease}, () => {
          ready.set(true);
          progress.set(withSpring(goal.value, {dampingRatio: 1, duration: 220}));
        }),
      ),
    );
  }, [progress, ready, goal, reduce]);
  useEffect(() => {
    goal.set(target);
    if (ready.value) {
      progress.set(withSpring(target, {dampingRatio: 1, duration: 220}));
    }
  }, [target, progress, ready, goal]);

  const full = useMemo(() => Skia.Path.MakeFromSVGString(arcPath(CX, CY, R, 0, 1))!, []);
  const red = useMemo(() => Skia.Path.MakeFromSVGString(arcPath(CX, CY, R, fraction(redline, max), 1))!, [redline, max]);
  const marks = useMemo(() => ticks(max, 1000, 500), [max]);
  const accent = hot ? c.red : c.accent;
  const tip = useDerivedValue(() => polar(CX, CY, R, angleAt(progress.value)));
  const tipX = useDerivedValue(() => tip.value.x);
  const tipY = useDerivedValue(() => tip.value.y);

  return (
    <Card style={{alignItems: 'center', paddingVertical: 18}}>
      <View style={{width: SIZE, height: SIZE * 0.9}} accessible accessibilityLabel={`${Math.round(rpm ?? 0)} RPM, ${speed} ${speedUnit}${parked ? ', parked' : gear ? `, gear ${gear}` : ''}`}>
        <Canvas style={{width: SIZE, height: SIZE}}>
          <Path path={full} style="stroke" strokeWidth={STROKE} strokeCap="round" color={withAlpha(c.textPrimary, 0.07)} />
          <Path path={red} style="stroke" strokeWidth={STROKE} strokeCap="round" color={withAlpha(c.red, hot ? 0.55 : 0.25)} />
          {marks.map((t) => (
            <Tick key={t.value} share={fraction(t.value, max)} major={t.major} progress={progress} lit={accent} dim={withAlpha(c.textPrimary, 0.18)} />
          ))}
          {/* Soft glow under the lit arc, then the arc itself shading from tint to full accent. */}
          <Path path={full} start={0} end={progress} style="stroke" strokeWidth={STROKE + 8} strokeCap="round" color={accent} opacity={0.25}>
            <BlurMask blur={10} style="normal" />
          </Path>
          <Path path={full} start={0} end={progress} style="stroke" strokeWidth={STROKE} strokeCap="round">
            <SweepGradient c={vec(CX, CY)} start={135} end={405} colors={[withAlpha(accent, 0.45), accent, accent]} positions={[0, 0.55, 1]} />
          </Path>
          <Circle cx={tipX} cy={tipY} r={STROKE / 2 + 3} color={accent} opacity={0.5}>
            <BlurMask blur={6} style="normal" />
          </Circle>
          <Circle cx={tipX} cy={tipY} r={4} color={c.onAccent} />
        </Canvas>
        {/* Starts below the top ticks; the chips sit in the open gap at the bottom of the arc. */}
        <View style={{position: 'absolute', top: 62, left: 0, right: 0, alignItems: 'center'}}>
          <AppText size={54} weight="black" style={{lineHeight: 58, fontVariant: ['tabular-nums']}}>
            {speed}
          </AppText>
          <AppText size={14} weight="bold" tone="secondary">
            {speedUnit}
          </AppText>
          <View style={{flexDirection: 'row', gap: 8, marginTop: 4, alignItems: 'center'}}>
            <AppText size={20} weight="black" color={hot ? c.red : c.textPrimary} style={{fontVariant: ['tabular-nums']}}>
              {rpm == null ? '—' : Math.round(rpm).toLocaleString('en-US')}
            </AppText>
            <AppText size={12} weight="bold" tone="secondary">
              RPM
            </AppText>
          </View>
          <View style={{flexDirection: 'row', gap: 8, marginTop: 8}}>
            <ShiftChip icon="parking" label={parked ? 'Parked' : null} on={parked} />
            <ShiftChip icon="car-shift-pattern" label={parked ? null : (gear ?? '–')} on={!parked && gear != null} />
          </View>
        </View>
      </View>
    </Card>
  );
}
