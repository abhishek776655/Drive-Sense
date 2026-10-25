import {BlurMask, Canvas, Circle, DashPathEffect, Group, Path, Skia} from '@shopify/react-native-skia';
import {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useUnits} from '../../hooks/useUnits';
import type {GaugeStyle} from '../../stores/driveSettingsStore';
import {useAppTheme} from '../../theme/ThemeProvider';
import {RollingNumber} from '../RollingNumber';
import {NeonFace, TapeFace} from './CreativeGauges';
import {gaugeNumberSpot, NEEDLE_THEMES, ROAD_THEMES} from '../../theme/gaugeThemes';
import {RoadFace, ThemedNeedle} from './ThemedGauges';
import {arcPath, clampFraction, GAUGE_START_DEG} from '../../utils/gaugeMath';
import {useSpringTo} from './gaugeMotion';

interface GaugeDialProps {
  /** Speed and dial full scale, both in the chosen unit (km/h or mph). */
  speed: number;
  scale: number;
  gaugeStyle: GaugeStyle;
  accent: string;
  size: number;
}

const END_DEG = GAUGE_START_DEG + 270;

/** Line box height as a share of the font size, and where the baseline falls inside it (Nunito). */
const LINE = 1.2;
const BASELINE_FROM_TOP = 0.98;

/** The original Arc: a dotted outer ring, a soft track, and the accent arc with its glow. */
function ArcFace({share, accent, unit, size}: {share: ReturnType<typeof useSpringTo>; accent: string; unit: string; size: number}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const k = size / 200;
  const ring = useMemo(() => Skia.Path.MakeFromSVGString(arcPath(100, 100, 94, GAUGE_START_DEG, END_DEG))!, []);
  const arc = useMemo(() => Skia.Path.MakeFromSVGString(arcPath(100, 100, 80, GAUGE_START_DEG, END_DEG))!, []);
  return (
    <>
      <Canvas style={StyleSheet.absoluteFill}>
        <Group transform={[{scale: k}]}>
          <Circle cx={100} cy={100} r={97} color={c.card} opacity={0.35} />
          <Circle cx={100} cy={100} r={97} style="stroke" strokeWidth={1.5} color={c.separator} />
          <Path path={ring} style="stroke" strokeWidth={2} color={c.textSecondary} opacity={0.5}>
            <DashPathEffect intervals={[1.2, 9.4]} />
          </Path>
          <Path path={arc} style="stroke" strokeWidth={14} strokeCap="round" color={c.textTertiary} opacity={0.4} />
          <Path path={arc} start={0} end={share} style="stroke" strokeWidth={22} strokeCap="round" color={accent} opacity={0.35}>
            <BlurMask blur={4} style="normal" />
          </Path>
          <Path path={arc} start={0} end={share} style="stroke" strokeWidth={14} strokeCap="round" color={accent} />
        </Group>
      </Canvas>
      <Text style={[styles.unit, {top: 126 * k, fontSize: 13 * k, fontFamily: theme.font.bold, color: c.textSecondary}]}>{unit}</Text>
    </>
  );
}

/**
 * The Drive speedometer in all its styles, drawn with Skia on one 200×200 grid scaled to `size`
 * (Arc here; HUD and Neon in `CreativeGauges`; vehicle needles and road scenes in `ThemedGauges`).
 * One spring per reading drives every face on the UI thread, so arcs, needles and the tape glide
 * to each new speed instead of jumping.
 */
export function GaugeDial({speed, scale, gaugeStyle, accent, size}: GaugeDialProps) {
  const theme = useAppTheme();
  const c = theme.colors;
  const {speedUnit} = useUnits();
  const share = useSpringTo(clampFraction(speed, scale));
  const value = useSpringTo(speed);
  const number = gaugeNumberSpot(gaugeStyle);
  // The 200-unit grid scaled to the dial's size.
  const k = size / 200;

  return (
    <View style={{width: size, height: size}}>
      {gaugeStyle === 'arc' && <ArcFace share={share} accent={accent} unit={speedUnit} size={size} />}
      {gaugeStyle === 'tape' && <TapeFace value={value} scale={scale} accent={accent} unit={speedUnit} size={size} />}
      {gaugeStyle === 'neon' && <NeonFace share={share} accent={accent} unit={speedUnit} size={size} />}
      {gaugeStyle in NEEDLE_THEMES && <ThemedNeedle share={share} scale={scale} unit={speedUnit} size={size} t={NEEDLE_THEMES[gaugeStyle as keyof typeof NEEDLE_THEMES]} />}
      {gaugeStyle in ROAD_THEMES && <RoadFace share={share} speed={speed} size={size} t={ROAD_THEMES[gaugeStyle as keyof typeof ROAD_THEMES]} />}
      {/* The speed sits over the drawing as text so its digits can roll like a timer. */}
      <View pointerEvents="none" style={{position: 'absolute', left: 0, right: 0, top: (number.baseline - number.fontSize * BASELINE_FROM_TOP) * k}}>
        <RollingNumber value={speed} size={number.fontSize * k} lineHeight={number.fontSize * LINE * k} weight={number.weight} color={number.color ?? c.textPrimary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  unit: {position: 'absolute', left: 0, right: 0, textAlign: 'center'},
});
