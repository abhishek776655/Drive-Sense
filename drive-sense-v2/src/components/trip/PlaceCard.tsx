import {Ionicons} from '@expo/vector-icons';
import {View} from 'react-native';
import {useAppTheme} from '../../theme/ThemeProvider';
import type {DayPeriod} from '../../utils/tripAnalysis';
import {AppText} from '../AppText';
import {Card} from '../Card';
import {clockTime} from './timeOfDay';

function Row({color, place, time}: {color: string; place: string | null; time: string | null}) {
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
      <View style={{width: 10, height: 10, borderRadius: 5, backgroundColor: color}} />
      <AppText size={15} weight="extrabold" numberOfLines={1} style={{flex: 1}}>
        {place ?? 'Unknown place'}
      </AppText>
      {time ? (
        <AppText size={13} weight="bold" tone="secondary">
          {clockTime(time)}
        </AppText>
      ) : null}
    </View>
  );
}

/** Where and when the drive started and ended, with a Day / Night chip. */
export function PlaceCard({startAddress, endAddress, startTime, endTime, period}: {startAddress: string | null; endAddress: string | null; startTime: string; endTime: string | null; period: DayPeriod}) {
  const c = useAppTheme().colors;
  const night = period === 'night';
  return (
    <Card style={{padding: 16, gap: 12}}>
      <Row color={c.green} place={startAddress} time={startTime} />
      <Row color={c.red} place={endAddress} time={endTime} />
      <View style={{flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, backgroundColor: c.control}}>
        <Ionicons name={night ? 'moon' : 'sunny'} size={13} color={night ? c.purple : c.amber} />
        <AppText size={12} weight="extrabold" color={night ? c.purple : c.amber}>
          {night ? 'Night' : 'Day'}
        </AppText>
      </View>
    </Card>
  );
}
