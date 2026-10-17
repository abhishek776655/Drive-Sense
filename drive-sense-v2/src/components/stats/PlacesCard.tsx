import {Ionicons} from '@expo/vector-icons';
import {View} from 'react-native';
import type {StatsOverview} from '../../services/statsService';
import {withAlpha} from '../../theme/color';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {Card} from '../Card';

/** Top destination cities in the period, with a bar for how often each was the end of a drive. */
export function PlacesCard({places}: {places: StatsOverview['places']}) {
  const c = useAppTheme().colors;
  const max = Math.max(...places.map((p) => p.visits), 1);
  return (
    <Card style={{padding: 16, gap: 12}}>
      {places.map((place) => (
        <View key={place.name} style={{gap: 6}}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
            <Ionicons name="location" size={15} color={c.accent} />
            <AppText size={14} weight="extrabold" numberOfLines={1} style={{flex: 1}}>
              {place.name}
            </AppText>
            <AppText size={13} weight="bold" tone="secondary">
              {place.visits} {place.visits === 1 ? 'visit' : 'visits'}
            </AppText>
          </View>
          <View style={{height: 6, borderRadius: 3, backgroundColor: c.canvas, overflow: 'hidden'}}>
            <View style={{width: `${(place.visits / max) * 100}%`, height: '100%', borderRadius: 3, backgroundColor: withAlpha(c.accent, 0.75)}} />
          </View>
        </View>
      ))}
    </Card>
  );
}
