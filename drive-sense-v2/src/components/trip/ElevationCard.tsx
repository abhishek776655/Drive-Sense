import {Ionicons} from '@expo/vector-icons';
import {useState} from 'react';
import {View} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {useAppTheme} from '../../theme/ThemeProvider';
import {formatSpan} from '../../utils/format';
import type {ElevationProfile} from '../../utils/tripAnalysis';
import {AppText} from '../AppText';
import {Card} from '../Card';
import {linePath} from './chartPath';

const H = 90;
/** Flat drives stay flat: the chart always spans at least this many metres. */
const MIN_SPAN_M = 20;

function Figure({icon, color, value, label, unit = 'm'}: {icon?: keyof typeof Ionicons.glyphMap; color?: string; value: string; label: string; unit?: string}) {
  return (
    <View style={{flex: 1, alignItems: 'center', gap: 2}}>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
        {icon ? <Ionicons name={icon} size={14} color={color} /> : null}
        <AppText size={16} weight="black">
          {value}
          <AppText size={11} weight="bold" tone="secondary">
            {unit ? ` ${unit}` : ''}
          </AppText>
        </AppText>
      </View>
      <AppText size={11} weight="bold" tone="secondary">
        {label}
      </AppText>
    </View>
  );
}

/** Altitude over the drive: climb and descent, highest and lowest, and time spent climbing, descending and flat. */
export function ElevationCard({profile}: {profile: ElevationProfile}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const [width, setWidth] = useState(0);
  // Centre a small range in the minimum span rather than drawing it as a cliff.
  const lift = Math.max(0, (MIN_SPAN_M - (profile.maxM - profile.minM)) / 2);
  const {line, area} = linePath(profile.series.map((s) => ({x: s.t, y: s.m - profile.minM + lift})), width, H, 4, MIN_SPAN_M);
  return (
    <Card style={{padding: 16, gap: 14}}>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{height: H}}>
        {width > 0 ? (
          <Svg width={width} height={H}>
            <Path d={area} fill={c.green} fillOpacity={0.18} />
            <Path d={line} fill="none" stroke={c.green} strokeWidth={2.5} strokeLinejoin="round" />
          </Svg>
        ) : null}
      </View>
      <View style={{flexDirection: 'row'}}>
        <Figure icon="trending-up" color={c.green} value={String(profile.gainM)} label="Climb" />
        <Figure icon="trending-down" color={c.red} value={String(profile.lossM)} label="Descent" />
        <Figure value={String(Math.round(profile.maxM))} label="Highest" />
        <Figure value={String(Math.round(profile.minM))} label="Lowest" />
      </View>
      <View style={{flexDirection: 'row', paddingTop: 12, borderTopWidth: 1, borderTopColor: c.separator}}>
        <Figure icon="arrow-up" color={c.green} value={formatSpan(profile.climbS)} unit="" label="Climbing" />
        <Figure icon="arrow-down" color={c.red} value={formatSpan(profile.descentS)} unit="" label="Descending" />
        <Figure icon="arrow-forward" color={c.textSecondary} value={formatSpan(profile.flatS)} unit="" label="Flat" />
      </View>
    </Card>
  );
}
