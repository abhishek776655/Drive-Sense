import {useState} from 'react';
import {View} from 'react-native';
import {useUnits} from '../../hooks/useUnits';
import {useAppTheme} from '../../theme/ThemeProvider';
import {formatSpan} from '../../utils/format';
import {speedColor} from '../../utils/speedColor';
import {speedBandLabel} from '../../utils/stats';
import type {SpeedBand} from '../../utils/tripAnalysis';
import {AppText} from '../AppText';
import {Card} from '../Card';
import {SegmentedToggle} from './SegmentedToggle';

/** Middle of each band, for its colour on the speed scale. */
const BAND_MID_KMH = [10, 30, 50, 70, 90, 110];

type Measure = 'time' | 'distance';

/** Share of moving time (or distance) spent in each speed band. */
export function TimeAtSpeedCard({bands}: {bands: SpeedBand[]}) {
  const c = useAppTheme().colors;
  const u = useUnits();
  const [measure, setMeasure] = useState<Measure>('time');
  const totalM = bands.reduce((sum, b) => sum + b.meters, 0);
  if (bands.every((b) => b.seconds === 0)) {
    return null;
  }
  return (
    <Card style={{padding: 16, gap: 12}}>
      <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
        <AppText size={15} weight="black">
          Time at speed <AppText size={12} weight="bold" tone="secondary">{u.speedUnit}</AppText>
        </AppText>
        <SegmentedToggle
          options={[
            {value: 'time', label: 'Time'},
            {value: 'distance', label: 'Distance'},
          ]}
          value={measure}
          onChange={setMeasure}
        />
      </View>
      {bands.map((band, i) => {
        if (band.seconds === 0) {
          return null;
        }
        const share = measure === 'time' ? band.share : totalM > 0 ? band.meters / totalM : 0;
        return (
          <View key={band.label} style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
            <AppText size={13} weight="extrabold" style={{width: 52}}>
              {speedBandLabel(band.label, u.units)}
            </AppText>
            <View style={{flex: 1, height: 10, borderRadius: 5, backgroundColor: c.control, overflow: 'hidden'}}>
              <View style={{width: `${Math.max(2, share * 100)}%`, height: '100%', borderRadius: 5, backgroundColor: speedColor(BAND_MID_KMH[i], c)}} />
            </View>
            <AppText size={12} weight="bold" tone="secondary" style={{width: 96, textAlign: 'right'}}>
              {measure === 'time' ? formatSpan(band.seconds) : `${u.distance(band.meters)} ${u.distanceUnit}`} · {Math.round(share * 100)}%
            </AppText>
          </View>
        );
      })}
    </Card>
  );
}
