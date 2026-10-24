import {View} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {withAlpha} from '../../theme/color';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {Card} from '../Card';

const SIZE = 250;
const STROKE = 16;
const R = (SIZE - STROKE) / 2 - 4;
/** The arc runs 240°, gap at the bottom. */
const START = 150;
const SWEEP = 240;

const point = (deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return {x: SIZE / 2 + R * Math.cos(rad), y: SIZE / 2 + R * Math.sin(rad)};
};

const arc = (from: number, to: number) => {
  const a = point(START + SWEEP * from);
  const b = point(START + SWEEP * to);
  const large = SWEEP * (to - from) > 180 ? 1 : 0;
  return `M${a.x} ${a.y}A${R} ${R} 0 ${large} 1 ${b.x} ${b.y}`;
};

/** Full scale in rpm: 8000, or a round step above the highest seen (some engines rev past it). */
const scaleFor = (rpm: number) => Math.max(8000, Math.ceil(rpm / 1000) * 1000);

/**
 * The Telemetry hero: RPM on a sweeping arc with the redline band, speed big in the middle and the
 * guessed gear under it.
 */
export function RpmDial({rpm, speed, speedUnit, gear, redline}: {rpm: number | null; speed: string; speedUnit: string; gear: string | null; redline: number}) {
  const c = useAppTheme().colors;
  const max = scaleFor(rpm ?? 0);
  const share = Math.min(1, Math.max(0, (rpm ?? 0) / max));
  const red = redline / max;
  const hot = (rpm ?? 0) >= redline;
  return (
    <Card style={{alignItems: 'center', paddingVertical: 18}}>
      <View style={{width: SIZE, height: SIZE * 0.86}} accessible accessibilityLabel={`${Math.round(rpm ?? 0)} RPM, ${speed} ${speedUnit}${gear ? `, gear ${gear}` : ''}`}>
        <Svg width={SIZE} height={SIZE}>
          <Path d={arc(0, 1)} stroke={withAlpha(c.textPrimary, 0.08)} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
          <Path d={arc(red, 1)} stroke={withAlpha(c.red, 0.35)} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
          {share > 0.005 ? <Path d={arc(0, share)} stroke={hot ? c.red : c.accent} strokeWidth={STROKE} strokeLinecap="round" fill="none" /> : null}
        </Svg>
        <View style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center'}}>
          <AppText size={64} weight="black" style={{lineHeight: 68, fontVariant: ['tabular-nums']}}>
            {speed}
          </AppText>
          <AppText size={14} weight="bold" tone="secondary">
            {speedUnit}
          </AppText>
          <View style={{flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center'}}>
            <AppText size={20} weight="black" color={hot ? c.red : c.textPrimary} style={{fontVariant: ['tabular-nums']}}>
              {rpm == null ? '—' : Math.round(rpm).toLocaleString('en-US')}
            </AppText>
            <AppText size={12} weight="bold" tone="secondary">
              RPM
            </AppText>
            {gear ? (
              <View style={{marginLeft: 4, minWidth: 30, height: 26, borderRadius: 8, paddingHorizontal: 8, backgroundColor: c.accentTint, alignItems: 'center', justifyContent: 'center'}}>
                <AppText size={15} weight="black" tone="accent">
                  {gear}
                </AppText>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Card>
  );
}
