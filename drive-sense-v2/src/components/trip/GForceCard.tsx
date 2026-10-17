import {Ionicons} from '@expo/vector-icons';
import {useState} from 'react';
import {View} from 'react-native';
import Svg, {ClipPath, Defs, Line, Path, Rect} from 'react-native-svg';
import {useAppTheme} from '../../theme/ThemeProvider';
import {DASH, formatG} from '../../utils/format';
import type {GSample} from '../../utils/tripAnalysis';
import {AppText} from '../AppText';
import {Card} from '../Card';
import {clockTime} from './timeOfDay';

const H = 110;
const PAD = 6;
/** The chart always shows at least ±0.3 g, so calm driving looks calm. */
const MIN_RANGE_G = 0.3;
/** Samples further apart than this are not joined. */
const GAP_MS = 6000;

function Peak({icon, color, value, label, at}: {icon: keyof typeof Ionicons.glyphMap; color: string; value: string; label: string; at: number | null}) {
  return (
    <View style={{flex: 1, alignItems: 'center', gap: 2}}>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
        <Ionicons name={icon} size={16} color={color} />
        <AppText size={20} weight="black">
          {value}
          <AppText size={12} weight="bold" tone="secondary">
            {' '}G
          </AppText>
        </AppText>
      </View>
      <AppText size={12} weight="bold" tone="secondary">
        {label}
      </AppText>
      {at != null ? (
        <AppText size={11} weight="semibold" tone="tertiary">
          {clockTime(at)}
        </AppText>
      ) : null}
    </View>
  );
}

/**
 * Forward G over the drive: above the line is speeding up (green), below is braking (red).
 * Worked out from GPS speed, so every trip has it; a phone-sensor peak is shown when recorded.
 */
export function GForceCard({samples, peakAccel, peakBrake, sensorMaxG, sensor = []}: {samples: GSample[]; peakAccel: GSample | null; peakBrake: GSample | null; sensorMaxG: number | null; sensor?: {t: number; g: number}[]}) {
  const c = useAppTheme().colors;
  const [width, setWidth] = useState(0);
  if (samples.length < 2) {
    return null;
  }
  const range = Math.max(MIN_RANGE_G, ...samples.map((s) => Math.abs(s.g)), ...sensor.map((s) => s.g));
  const t0 = samples[0].t;
  const span = Math.max(1, samples[samples.length - 1].t - t0);
  const mid = H / 2;
  const x = (t: number) => PAD + ((t - t0) / span) * (width - PAD * 2);
  const y = (g: number) => mid - (g / range) * (mid - PAD);
  // Break the line where there is no data (a stop, a pause) instead of drawing a slope across it.
  const runs: GSample[][] = [];
  samples.forEach((s, i) => {
    if (i === 0 || s.t - samples[i - 1].t > GAP_MS) {
      runs.push([s]);
    } else {
      runs[runs.length - 1].push(s);
    }
  });
  const pathOf = (run: GSample[]) => run.map((s, i) => `${i === 0 ? 'M' : 'L'}${x(s.t).toFixed(1)} ${y(s.g).toFixed(1)}`).join('');
  const line = runs.map(pathOf).join('');
  // The phone's own readings (total G, any direction) as a second line above the axis.
  const sensorLine = sensor.length > 1 ? sensor.map((s, i) => `${i === 0 || s.t - sensor[i - 1].t > GAP_MS ? 'M' : 'L'}${x(s.t).toFixed(1)} ${y(s.g).toFixed(1)}`).join('') : '';
  const area = runs.map((run) => `${pathOf(run)}L${x(run[run.length - 1].t).toFixed(1)} ${mid}L${x(run[0].t).toFixed(1)} ${mid}Z`).join('');
  return (
    <Card style={{padding: 16, gap: 14}}>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{height: H}}>
        {width > 0 ? (
          <Svg width={width} height={H}>
            <Defs>
              <ClipPath id="gUp">
                <Rect x={0} y={0} width={width} height={mid} />
              </ClipPath>
              <ClipPath id="gDown">
                <Rect x={0} y={mid} width={width} height={mid} />
              </ClipPath>
            </Defs>
            <Path d={area} fill={c.green} fillOpacity={0.25} clipPath="url(#gUp)" />
            <Path d={area} fill={c.red} fillOpacity={0.25} clipPath="url(#gDown)" />
            <Line x1={PAD} y1={mid} x2={width - PAD} y2={mid} stroke={c.separator} strokeWidth={1} strokeDasharray="4 4" />
            <Path d={line} fill="none" stroke={c.textSecondary} strokeWidth={1.5} strokeLinejoin="round" />
            {sensorLine ? <Path d={sensorLine} fill="none" stroke={c.purple} strokeOpacity={0.85} strokeWidth={1.5} strokeLinejoin="round" /> : null}
          </Svg>
        ) : null}
      </View>
      <View style={{flexDirection: 'row'}}>
        <Peak icon="arrow-up" color={c.green} value={peakAccel ? formatG(peakAccel.g) : DASH} label="Peak acceleration" at={peakAccel?.t ?? null} />
        <View style={{width: 1, backgroundColor: c.separator}} />
        <Peak icon="arrow-down" color={c.red} value={peakBrake ? formatG(-peakBrake.g) : DASH} label="Peak braking" at={peakBrake?.t ?? null} />
      </View>
      {sensorLine ? (
        <View style={{flexDirection: 'row', justifyContent: 'center', gap: 16}}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 5}}>
            <View style={{width: 12, height: 2, borderRadius: 1, backgroundColor: c.textSecondary}} />
            <AppText size={11} weight="bold" tone="secondary">
              Speed change (GPS)
            </AppText>
          </View>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 5}}>
            <View style={{width: 12, height: 2, borderRadius: 1, backgroundColor: c.purple}} />
            <AppText size={11} weight="bold" tone="secondary">
              Phone sensor
            </AppText>
          </View>
        </View>
      ) : null}
      {sensorMaxG != null ? (
        <AppText size={12} weight="semibold" tone="secondary" style={{textAlign: 'center'}}>
          Phone sensor peak {formatG(sensorMaxG)} G (includes cornering)
        </AppText>
      ) : null}
    </Card>
  );
}
