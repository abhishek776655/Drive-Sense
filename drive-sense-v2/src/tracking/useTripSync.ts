import {useEffect} from 'react';
import {AppState} from 'react-native';
import {useRecordingStore} from '../stores/recordingStore';
import {syncNow} from './tripSync';

/** Seconds between uploads while a drive is live (the old app streamed on every point). */
const SYNC_EVERY_MS = 8000;

/**
 * Keeps the live drive uploaded: right after Start, every few seconds while it runs, and whenever
 * the app comes back to the foreground. Offline just means points wait in the queue.
 */
export function useTripSync(): void {
  const live = useRecordingStore((s) => s.status !== 'ready');

  useEffect(() => {
    if (!live) {
      return;
    }
    void syncNow();
    const timer = setInterval(() => void syncNow(), SYNC_EVERY_MS);
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void syncNow();
      }
    });
    return () => {
      clearInterval(timer);
      appState.remove();
    };
  }, [live]);
}
