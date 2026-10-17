import {View} from 'react-native';
import {useUnits} from '../../hooks/useUnits';
import {withAlpha} from '../../theme/color';
import {useAppTheme} from '../../theme/ThemeProvider';
import type {DistanceBucket} from '../../utils/tripAnalysis';
import {AppText} from '../AppText';
import {Card} from '../Card';
import {clockTime} from './timeOfDay';

const H = 96;
/** Bars never get wider than this, so a short drive does not draw one slab. */
const MAX_BAR = 28;
/** Room for a time label under a bar. */
const MAX_COLUMN = 60;

/** Distance driven in each slice of the drive (5 min, 15 min or an hour, by trip length). */
export function DistanceByTimeCard({buckets, bucketMinutes}: {buckets: DistanceBucket[]; bucketMinutes: number}) {
  const c = useAppTheme().colors;
  const u = useUnits();
  if (buckets.length === 0) {
    return null;
  }
  const max = Math.max(1, ...buckets.map((b) => b.meters));
  const total = buckets.reduce((sum, b) => sum + b.meters, 0);
  const peak = buckets.reduce((best, b) => (b.meters > best.meters ? b : best), buckets[0]);
  // Label every bar when few, else about four labels across.
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 4));
  return (
    <Card style={{padding: 16, gap: 12}}>
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end'}}>
        <View>
          <AppText size={12} weight="bold" tone="secondary">
            Per {bucketMinutes === 60 ? 'hour' : `${bucketMinutes} min`}
          </AppText>
          <AppText size={18} weight="black">
            {u.distance(total)} <AppText size={12} weight="bold" tone="secondary">{u.distanceUnit} total</AppText>
          </AppText>
        </View>
        <View style={{alignItems: 'flex-end'}}>
          <AppText size={11} weight="extrabold" tone="secondary" style={{letterSpacing: 0.6}}>
            PEAK
          </AppText>
          <AppText size={18} weight="black" color={c.cyan}>
            {u.distance(peak.meters)} <AppText size={12} weight="bold" tone="secondary">{u.distanceUnit}</AppText>
          </AppText>
        </View>
      </View>
      <View style={{flexDirection: 'row', justifyContent: 'center', gap: 4}}>
        {buckets.map((b, i) => (
          <View key={b.start} style={{flex: 1, maxWidth: MAX_COLUMN, alignItems: 'center', gap: 6}}>
            <View style={{height: H, width: '100%', maxWidth: MAX_BAR, justifyContent: 'flex-end'}}>
              <View style={{height: Math.max(3, (b.meters / max) * H), borderRadius: 6, backgroundColor: b === peak ? c.cyan : withAlpha(c.cyan, 0.35)}} />
            </View>
            <AppText size={10} weight="bold" tone="tertiary" numberOfLines={1}>
              {i % labelEvery === 0 ? clockTime(b.start) : ' '}
            </AppText>
          </View>
        ))}
      </View>
    </Card>
  );
}
