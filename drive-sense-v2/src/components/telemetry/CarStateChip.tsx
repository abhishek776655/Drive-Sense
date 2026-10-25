import {Ionicons} from '@expo/vector-icons';
import {useEffect, useState} from 'react';
import {View} from 'react-native';
import {adapterGoverns, carState, type CarState} from '../../obd/sourceRules';
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
 * with the ignition on, or parked with the ignition off. Either way, once the engine has been off for
 * the Auto-stop time the drive ends; the time left is counted down here.
 */
export function CarStateChip() {
  const c = useAppTheme().colors;
  const values = useObdStore((s) => s.values);
  const recording = useRecordingStore((s) => s.status === 'recording' || (s.status === 'paused' && s.autoPaused));
  const startedAt = useRecordingStore((s) => s.startedAt);
  const engineOnAt = useObdStore((s) => s.engineOnAt);
  const autoStop = usePreferencesStore((s) => s.autoStop);
  const stopS = usePreferencesStore((s) => s.autoStopMinutes) * 60;
  const now = useNow();
  const state = carState(values, now);
  const counting = recording && autoStop && startedAt != null && adapterGoverns(engineOnAt, startedAt);
  const left = counting && engineOnAt != null ? Math.max(0, Math.ceil(stopS - (now - engineOnAt) / 1000)) : null;
  const endsIn = left == null ? null : left > 0 ? `Drive ends in ${left >= 60 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : `${left} s`}` : 'Ending drive…';
  const look = {
    running: {icon: 'flash' as const, color: c.green, title: '', note: null},
    engineOff: {icon: 'pause-circle' as const, color: c.amber, title: 'Engine off · ignition on', note: endsIn},
    parked: {
      icon: 'car' as const,
      color: c.textSecondary,
      title: 'Parked · ignition off',
      note: endsIn,
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
