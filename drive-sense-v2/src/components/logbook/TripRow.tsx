import {Ionicons} from '@expo/vector-icons';
import {Pressable, View} from 'react-native';
import {useUnits} from '../../hooks/useUnits';
import type {TripSummary} from '../../services/tripService';
import {useAppTheme} from '../../theme/ThemeProvider';
import {formatDuration} from '../../utils/format';
import {tripTitle} from '../../utils/logbook';
import {AppText} from '../AppText';
import {Card} from '../Card';
import {StatChip} from './StatChip';

interface TripRowProps {
  trip: TripSummary;
  selecting: boolean;
  selected: boolean;
  onPress: () => void;
}

/** Rovy's Logbook row: day block, where the drive went, and km · time · top speed chips. */
export function TripRow({trip, selecting, selected, onPress}: TripRowProps) {
  const c = useAppTheme().colors;
  const u = useUnits();
  const at = new Date(trip.start_time);
  const title = tripTitle(trip);
  const time = at.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'});
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Drive on ${at.toLocaleDateString('en-IN', {weekday: 'long', day: 'numeric', month: 'long'})}, ${title}`}
      accessibilityState={selecting ? {selected} : undefined}
      onPress={onPress}
      style={({pressed}) => ({opacity: pressed ? 0.8 : 1})}>
      <Card style={{flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, gap: 10, borderRadius: 44}}>
        <View style={{width: 48, alignItems: 'center'}}>
          <AppText size={12} weight="semibold" tone="secondary">
            {at.toLocaleDateString('en-IN', {weekday: 'short'})}
          </AppText>
          <AppText size={24} weight="extrabold" style={{lineHeight: 28}}>
            {at.getDate()}
          </AppText>
          <AppText size={11} weight="semibold" tone="tertiary" style={{fontVariant: ['tabular-nums']}}>
            {time}
          </AppText>
        </View>
        <View style={{flex: 1, gap: 7}}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
            <AppText size={16} weight="extrabold" numberOfLines={1} style={{flexShrink: 1}}>
              {title}
            </AppText>
            {/* Saved on the phone, not uploaded yet (local-first part 2a). */}
            {trip.pending ? <Ionicons name="cloud-upload-outline" size={15} color={c.textTertiary} accessibilityLabel="Waiting to upload" /> : null}
          </View>
          <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 5}}>
            <StatChip icon="map" color={c.blue} label={`${u.distance(trip.distance_meters)} ${u.distanceUnit}`} />
            <StatChip icon="stopwatch" color={c.cyan} label={formatDuration(trip.duration_seconds)} />
            <StatChip icon="speedometer" color={c.red} label={`${u.speed(trip.max_speed_mps)} ${u.speedUnit}`} />
          </View>
        </View>
        {selecting ? (
          <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={selected ? c.accent : c.textTertiary} />
        ) : (
          <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
        )}
      </Card>
    </Pressable>
  );
}
