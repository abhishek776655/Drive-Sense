import {Ionicons} from '@expo/vector-icons';
import {useState} from 'react';
import {Pressable, View} from 'react-native';
import {useUnits} from '../../hooks/useUnits';
import type {TripSummary} from '../../services/tripService';
import {useAppTheme} from '../../theme/ThemeProvider';
import {formatDuration} from '../../utils/format';
import {tripTitle} from '../../utils/logbook';
import {AppText} from '../AppText';
import {Card} from '../Card';
import {useVehicleStore} from '../../stores/vehicleStore';
import {VehicleIcon} from '../garage/VehicleIcon';
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
  // The vehicle's type for its icon; the name comes with the trip (a car glyph when unknown).
  const vehicleId = (trip as TripSummary & {vehicle_id?: string}).vehicle_id;
  const vehicleType = useVehicleStore((st) => st.vehicles.find((v) => v.id === vehicleId)?.vehicle_type ?? 'car');
  // Where the top-speed chip starts: the vehicle name sits right above it, on the title's line.
  const [speedChipX, setSpeedChipX] = useState<number | null>(null);
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
            <AppText size={16} weight="extrabold" numberOfLines={1} style={{flexShrink: 1, maxWidth: speedChipX != null && trip.vehicle_name ? speedChipX - 8 : undefined}}>
              {title}
            </AppText>
            {/* Saved on the phone, not uploaded yet (local-first part 2a). */}
            {trip.pending ? <Ionicons name="cloud-upload-outline" size={15} color={c.textTertiary} accessibilityLabel="Waiting to upload" /> : null}
            {/* The vehicle on the title's line, so the row keeps its height. */}
            {/* Chips wrapped onto two lines: the name goes to the end of the title line instead. */}
            {trip.vehicle_name ? (
              <View
                style={
                  speedChipX != null
                    ? {position: 'absolute', left: speedChipX, right: 0, flexDirection: 'row', alignItems: 'center', gap: 4}
                    : {flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto', maxWidth: '45%', flexShrink: 1}
                }>
                <VehicleIcon type={vehicleType} size={13} color={c.accent} />
                <AppText size={12} weight="bold" tone="secondary" numberOfLines={1} style={{flexShrink: 1}}>
                  {trip.vehicle_name}
                </AppText>
              </View>
            ) : null}
          </View>
          <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 5}}>
            <StatChip icon="map" color={c.blue} label={`${u.distance(trip.distance_meters)} ${u.distanceUnit}`} />
            <StatChip icon="stopwatch" color={c.cyan} label={formatDuration(trip.duration_seconds)} />
            <View onLayout={(e) => setSpeedChipX(e.nativeEvent.layout.y > 4 ? null : e.nativeEvent.layout.x)}>
              <StatChip icon="speedometer" color={c.red} label={`${u.speed(trip.max_speed_mps)} ${u.speedUnit}`} />
            </View>
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
