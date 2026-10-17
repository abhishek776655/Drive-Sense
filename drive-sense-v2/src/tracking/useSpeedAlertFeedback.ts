import * as Haptics from 'expo-haptics';
import {useEffect} from 'react';
import {useRecordingStore} from '../stores/recordingStore';

/** Vibrates each time the speed alert fires (the recording store decides when, see `nextSpeedAlert`). */
export function useSpeedAlertFeedback(): void {
  const firedAt = useRecordingStore((s) => s.speedAlert.lastAlertAt);
  useEffect(() => {
    if (firedAt != null) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [firedAt]);
}
