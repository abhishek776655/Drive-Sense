import {Ionicons} from '@expo/vector-icons';
import {useEffect, useState} from 'react';
import {View} from 'react-native';
import {carState, ENGINE_OFF_END_S, lastAnswerAt, type CarState} from '../../obd/sourceRules';
import {useObdStore} from '../../stores/obdStore';
import {usePreferencesStore} from '../../stores/preferencesStore';
import {useRecordingStore} from '../../stores/recordingStore';
import {withAlpha} from '../../theme/color';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {Card} from '../Card';

/** A clock ticking each second: going quiet sends no updates, so the car's state needs its own. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Running, engine off with the ignition on, or parked (ignition off), kept current each second. */
export function useCarState(): CarState {
  const values = useObdStore((s) => s.values);
  return carState(values, useNow());
}

/**
 * What the car is doing when it is not simply running (spec 2026-10-25, telemetry sources): engine off
 * with the ignition on (a long light: the drive carries on), or parked with the ignition off (the
 * drive ends a minute later, counted down here).
 */
export function CarStateChip() {
  const c = useAppTheme().colors;
  const values = useObdStore((s) => s.values);
  const recording = useRecordingStore((s) => s.status === 'recording');
  const autoStop = usePreferencesStore((s) => s.autoStop);
  const now = useNow();
  const state = carState(values, now);
  const answered = lastAnswerAt(values);
  const endsIn = answered == null ? null : Math.max(0, Math.ceil(ENGINE_OFF_END_S - (now - answered) / 1000));
  const look = {
    running: {icon: 'flash' as const, color: c.green, title: '', note: null},
    engineOff: {icon: 'pause-circle' as const, color: c.amber, title: 'Engine off · ignition on', note: recording ? 'Drive carries on' : null},
    parked: {
      icon: 'car' as const,
      color: c.textSecondary,
      title: 'Parked · ignition off',
      note: recording && autoStop && endsIn != null ? (endsIn > 0 ? `Drive ends in ${endsIn} s` : 'Ending drive…') : null,
    },
  }[state];

  // Running is the normal case; the dials already say so.
  if (state === 'running') {
    return null;
  }
  return (
    <Card style={{paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10}}>
      <View style={{width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(look.color, 0.14)}}>
        <Ionicons name={look.icon} size={17} color={look.color} />
      </View>
      <AppText size={15} weight="extrabold" style={{flex: 1}} accessibilityLiveRegion="polite">
        {look.title}
      </AppText>
      {look.note ? (
        <AppText size={13} weight="bold" tone="secondary">
          {look.note}
        </AppText>
      ) : null}
    </Card>
  );
}
