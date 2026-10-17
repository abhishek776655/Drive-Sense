import {useState} from 'react';
import {View} from 'react-native';
import Svg, {Circle, G} from 'react-native-svg';
import {useUnits} from '../../hooks/useUnits';
import type {StatsOverview} from '../../services/statsService';
import {useAppTheme} from '../../theme/ThemeProvider';
import {formatDuration, formatSpan} from '../../utils/format';
import {speedColor} from '../../utils/speedColor';
import {speedBandLabel} from '../../utils/stats';
import {AppText} from '../AppText';
import {Card} from '../Card';
import {SegmentedToggle} from '../trip/SegmentedToggle';
import {CardTitle} from './CardTitle';
import {BAND_MID_KMH} from './SpeedDistributionCard';

const SIZE = 132;
const STROKE = 20;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;
/** Gap between slices, in points along the ring. */
const GAP = 2;

type Measure = 'time' | 'distance';

/** Moving time (or distance) per speed band across every drive in the period, as a donut. */
export function TimeAtSpeedDonutCard({bands}: {bands: StatsOverview['time_at_speed']}) {
  const c = useAppTheme().colors;
  const u = useUnits();
  const [measure, setMeasure] = useState<Measure>('time');
  const amounts = bands.map((b) => (measure === 'time' ? b.seconds : b.meters));
  const total = amounts.reduce((sum, n) => sum + n, 0);
  if (total <= 0) {
    return null;
  }
  const slices = amounts.filter((n) => n > 0).length;
  // Where each slice starts along the ring: the sum of the slices before it.
  const starts = amounts.map((_, i) => (amounts.slice(0, i).reduce((sum, n) => sum + n, 0) / total) * CIRCUMFERENCE);
  return (
    <Card style={{padding: 16, gap: 14}}>
      <CardTitle
        title="Time at speed"
        subtitle={`${u.speedUnit}, while moving`}
        right={
          <SegmentedToggle
            options={[
              {value: 'time', label: 'Time'},
              {value: 'distance', label: 'Distance'},
            ]}
            value={measure}
            onChange={setMeasure}
          />
        }
      />
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 18}}>
        <View style={{width: SIZE, height: SIZE}}>
          <Svg width={SIZE} height={SIZE}>
            <G rotation={-90} origin={`${SIZE / 2}, ${SIZE / 2}`}>
              {amounts.map((amount, i) => {
                if (amount <= 0) {
                  return null;
                }
                const length = Math.max(0, (amount / total) * CIRCUMFERENCE - (slices > 1 ? GAP : 0));
                return (
                  <Circle
                    key={bands[i].label}
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={R}
                    fill="none"
                    stroke={speedColor(BAND_MID_KMH[i], c)}
                    strokeWidth={STROKE}
                    strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                    strokeDashoffset={-starts[i]}
                  />
                );
              })}
            </G>
          </Svg>
          <View style={{position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center'}}>
            <AppText size={16} weight="black" numberOfLines={1}>
              {measure === 'time' ? formatDuration(total) : u.distance(total)}
            </AppText>
            <AppText size={10} weight="bold" tone="secondary">
              {measure === 'time' ? 'moving' : u.distanceUnit}
            </AppText>
          </View>
        </View>
        <View style={{flex: 1, gap: 7}}>
          {bands.map((band, i) => (
            <View key={band.label} style={{flexDirection: 'row', alignItems: 'center', gap: 8, opacity: amounts[i] > 0 ? 1 : 0.4}}>
              <View style={{width: 9, height: 9, borderRadius: 5, backgroundColor: speedColor(BAND_MID_KMH[i], c)}} />
              <AppText size={12} weight="extrabold" style={{width: 46}}>
                {speedBandLabel(band.label, u.units)}
              </AppText>
              <AppText size={12} weight="bold" tone="secondary" numberOfLines={1} style={{flex: 1, textAlign: 'right'}}>
                {measure === 'time' ? formatSpan(band.seconds) : `${u.distance(band.meters)} ${u.distanceUnit}`} · {Math.round((amounts[i] / total) * 100)}%
              </AppText>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}
