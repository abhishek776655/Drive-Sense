import {Ionicons} from '@expo/vector-icons';
import {useState} from 'react';
import {Pressable, View} from 'react-native';
import {useAppTheme} from '../../theme/ThemeProvider';
import {EVENT_LABEL, HARD_INTENSITY, type EventBreakdown, type EventKind, type TripEventItem} from '../../utils/tripEvents';
import {AppText} from '../AppText';
import {Card} from '../Card';
import {EVENT_ICON, useEventColor} from '../summary/EventMarker';
import {clockTime} from './timeOfDay';

function KindTile({kind, label, count, hard}: {kind: EventKind; label: string; count: number; hard: number}) {
  const c = useAppTheme().colors;
  const color = useEventColor()(kind);
  return (
    <View style={{flexBasis: '45%', flexGrow: 1, padding: 12, borderRadius: 18, backgroundColor: c.control, gap: 4}}>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
        <Ionicons name={EVENT_ICON[kind]} size={14} color={color} />
        <AppText size={12} weight="bold" tone="secondary">
          {label}
        </AppText>
      </View>
      <View style={{flexDirection: 'row', alignItems: 'baseline', gap: 6}}>
        <AppText size={24} weight="black">
          {count}
        </AppText>
        {hard > 0 ? (
          <AppText size={12} weight="extrabold" color={c.red}>
            {hard} hard
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Speed-ups, hard braking and speeding: totals first; "Tap to see all" opens the list of every
 * event, and tapping an event shows it on the map.
 */
export function EventsCard({breakdown, onSelect}: {breakdown: EventBreakdown; onSelect: (event: TripEventItem) => void}) {
  const c = useAppTheme().colors;
  const eventColor = useEventColor();
  const [all, setAll] = useState(false);
  const shown = all ? breakdown.list : [];
  return (
    <Card style={{padding: 14, gap: 10}}>
      <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
        <KindTile kind="rapid_acceleration" label="Acceleration" {...breakdown.rapid_acceleration} />
        <KindTile kind="harsh_brake" label="Braking" {...breakdown.harsh_brake} />
        <KindTile kind="overspeed" label="Speeding" count={breakdown.overspeed.count} hard={0} />
        <KindTile kind="sharp_turn" label="Sharp turns" {...breakdown.sharp_turn} />
      </View>
      {breakdown.list.length === 0 ? (
        <AppText size={13} weight="semibold" tone="secondary" style={{textAlign: 'center', paddingVertical: 6}}>
          No harsh acceleration, braking, speeding or sharp turns. Smooth drive.
        </AppText>
      ) : null}
      {shown.map((event) => {
        const located = event.latitude != null && event.longitude != null;
        const hard = (event.intensity ?? 0) >= HARD_INTENSITY;
        return (
          <Pressable
            key={event.id}
            accessibilityRole="button"
            accessibilityLabel={`${EVENT_LABEL[event.kind]} at ${clockTime(event.at)}${located ? '. Show on map' : ''}`}
            disabled={!located}
            onPress={() => onSelect(event)}
            style={({pressed}) => ({flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 14, backgroundColor: pressed ? c.control : undefined})}>
            <View style={{width: 28, height: 28, borderRadius: 14, backgroundColor: eventColor(event.kind), alignItems: 'center', justifyContent: 'center'}}>
              <Ionicons name={EVENT_ICON[event.kind]} size={14} color={c.onAccent} />
            </View>
            <View style={{flex: 1}}>
              <AppText size={14} weight="extrabold">
                {EVENT_LABEL[event.kind]}
                {hard ? (
                  <AppText size={12} weight="extrabold" color={c.red}>
                    {'  '}hard
                  </AppText>
                ) : null}
              </AppText>
              {event.intensity != null ? (
                <AppText size={12} weight="semibold" tone="secondary">
                  {event.intensity.toFixed(1)}× the limit
                </AppText>
              ) : null}
            </View>
            <AppText size={13} weight="bold" tone="secondary">
              {clockTime(event.at)}
            </AppText>
            {located ? <Ionicons name="location-outline" size={16} color={c.textTertiary} /> : null}
          </Pressable>
        );
      })}
      {breakdown.list.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{expanded: all}}
          onPress={() => setAll((v) => !v)}
          hitSlop={8}
          style={({pressed}) => ({flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6, opacity: pressed ? 0.7 : 1})}>
          <AppText size={13} weight="extrabold" tone="accent">
            {all ? 'Hide events' : `Tap to see all ${breakdown.list.length} ${breakdown.list.length === 1 ? 'event' : 'events'}`}
          </AppText>
          <Ionicons name={all ? 'chevron-up' : 'chevron-down'} size={15} color={c.accent} />
        </Pressable>
      ) : null}
    </Card>
  );
}
