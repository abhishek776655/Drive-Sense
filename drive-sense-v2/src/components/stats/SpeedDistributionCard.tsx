import {View} from 'react-native';
import {useUnits} from '../../hooks/useUnits';
import type {StatsOverview} from '../../services/statsService';
import {useAppTheme} from '../../theme/ThemeProvider';
import {speedColor} from '../../utils/speedColor';
import {speedBandLabel} from '../../utils/stats';
import {AppText} from '../AppText';
import {Card} from '../Card';
import {CardTitle} from './CardTitle';

/** Middle of each 20 km/h band, for its colour on the speed scale (as on the trip page). */
export const BAND_MID_KMH = [10, 30, 50, 70, 90, 110];
const HEIGHT = 110;

/** How many drives topped out in each speed band. */
export function SpeedDistributionCard({bands}: {bands: StatsOverview['speed_distribution']}) {
  const c = useAppTheme().colors;
  const u = useUnits();
  const max = Math.max(...bands.map((b) => b.trips), 0);
  return (
    <Card style={{padding: 16, gap: 14}}>
      <CardTitle title="Speed distribution" subtitle={`Drives by top speed (${u.speedUnit})`} />
      <View style={{flexDirection: 'row', alignItems: 'flex-end', height: HEIGHT + 18, gap: 8}}>
        {bands.map((band, i) => (
          <View key={band.label} style={{flex: 1, alignItems: 'center', gap: 4}}>
            <AppText size={12} weight="extrabold" tone={band.trips > 0 ? 'primary' : 'tertiary'}>
              {band.trips}
            </AppText>
            <View
              style={{
                alignSelf: 'stretch',
                height: max > 0 && band.trips > 0 ? Math.max(6, (band.trips / max) * HEIGHT) : 4,
                borderRadius: 6,
                backgroundColor: band.trips > 0 ? speedColor(BAND_MID_KMH[i], c) : c.separator,
              }}
            />
          </View>
        ))}
      </View>
      <View style={{flexDirection: 'row', gap: 8, marginTop: -8}}>
        {bands.map((band) => (
          <AppText key={band.label} size={10} weight="bold" tone="tertiary" numberOfLines={1} adjustsFontSizeToFit style={{flex: 1, textAlign: 'center'}}>
            {speedBandLabel(band.label, u.units)}
          </AppText>
        ))}
      </View>
    </Card>
  );
}
