import {Ionicons} from '@expo/vector-icons';
import {ActivityIndicator, View} from 'react-native';
import type {TripDetail} from '../../services/tripService';
import {useAppTheme} from '../../theme/ThemeProvider';
import {countEvents, EVENT_KINDS, EVENT_LABEL, scoreTone, scoreVerdict} from '../../utils/tripEvents';
import {AppText} from '../AppText';
import {Card} from '../Card';
import {EVENT_ICON, useEventColor} from './EventMarker';

interface ScoreEventsCardProps {
  detail: TripDetail | null;
  /** True while the trip is still being stored and scored. */
  pending: boolean;
  /** The phone's own live count, shown until (or instead of) the server's breakdown. */
  phoneEventCount: number;
  /** Off where the page shows events in their own card (trip detail). */
  showEvents?: boolean;
}

/** Driving score (from the server, once stored) and the drive's events by kind. */
export function ScoreEventsCard({detail, pending, phoneEventCount, showEvents = true}: ScoreEventsCardProps) {
  const theme = useAppTheme();
  const c = theme.colors;
  const eventColor = useEventColor();
  const score = detail?.driving_score ?? null;
  const counts = detail ? countEvents(detail.events) : null;

  return (
    <Card style={{padding: 16, gap: 14}}>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 14}}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            borderWidth: 5,
            borderColor: score != null ? c[scoreTone(score)] : c.separator,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {score != null ? (
            <AppText size={22} weight="black">
              {Math.round(score)}
            </AppText>
          ) : pending ? (
            <ActivityIndicator color={c.textSecondary} />
          ) : (
            <AppText size={20} weight="black" tone="secondary">
              –
            </AppText>
          )}
        </View>
        <View style={{flex: 1}}>
          <AppText size={13} weight="bold" tone="secondary">
            Driving Score
          </AppText>
          <AppText size={17} weight="extrabold">
            {score != null ? scoreVerdict(score) : pending ? 'Scoring your drive…' : 'Not scored'}
          </AppText>
        </View>
      </View>

      {!showEvents ? null : counts ? (
        <View style={{flexDirection: 'row', gap: 8}}>
          {EVENT_KINDS.map((kind) => (
            <View key={kind} style={{flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 16, backgroundColor: c.control}}>
              <Ionicons name={EVENT_ICON[kind]} size={16} color={eventColor(kind)} />
              <AppText size={20} weight="black">
                {counts[kind]}
              </AppText>
              <AppText size={11} weight="bold" tone="secondary">
                {EVENT_LABEL[kind]}
              </AppText>
            </View>
          ))}
        </View>
      ) : (
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
          <Ionicons name="warning" size={15} color={c.amber} />
          <AppText size={13} weight="bold" tone="secondary">
            {phoneEventCount === 1 ? '1 event spotted on the drive' : `${phoneEventCount} events spotted on the drive`}
          </AppText>
        </View>
      )}
    </Card>
  );
}
