import {useEffect, useState} from 'react';
import {getDb} from '../db';
import {obdSamples} from '../db/obdRepos';
import {summarize} from '../obd/series';
import {useRecordingStore} from '../stores/recordingStore';

/** The drive's seconds are written in small batches, so re-reading more often than this adds nothing. */
const REFRESH_MS = 5000;

/**
 * The recording drive's mileage so far (L/100 km), worked out the same way as its summary at the
 * end: fuel and distance from its 1 Hz adapter rows. Null when not recording or too short to say.
 */
export function useDriveMileage(): number | null {
  const startedAt = useRecordingStore((s) => (s.status === 'recording' ? s.startedAt : null));
  const [l100, setL100] = useState<number | null>(null);
  useEffect(() => {
    if (startedAt == null) {
      return;
    }
    const read = () => {
      const db = getDb();
      if (!db) {
        return;
      }
      try {
        setL100(summarize(obdSamples(db, startedAt), 1).avgL100km);
      } catch {
        setL100(null);
      }
    };
    const first = setTimeout(read, 0);
    const id = setInterval(read, REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [startedAt]);
  // Not recording: nothing to show, whatever the last drive left behind.
  return startedAt == null ? null : l100;
}
