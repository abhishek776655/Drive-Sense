import {useEffect} from 'react';
import {useRecordingStore} from '../stores/recordingStore';

const ORIGIN = {latitude: 28.6139, longitude: 77.209};

/** Web has no device GPS worth driving with: a simulated loop stands in, like mobile-expo's mock. */
export function useLocationFeed(active: boolean): void {
  const ingest = useRecordingStore((state) => state.ingest);

  useEffect(() => {
    if (!active) {
      return;
    }
    let tick = 0;
    let lat = ORIGIN.latitude;
    let lon = ORIGIN.longitude;
    const timer = setInterval(() => {
      const recording = useRecordingStore.getState().status === 'recording';
      tick += 1;
      const speed = recording ? 12 + 8 * Math.sin(tick / 6) : 0;
      const heading = (tick * 4) % 360;
      if (recording) {
        const rad = (heading * Math.PI) / 180;
        lat += (speed * Math.cos(rad)) / 111320;
        lon += (speed * Math.sin(rad)) / (111320 * Math.cos((lat * Math.PI) / 180));
      }
      ingest({
        latitude: lat,
        longitude: lon,
        speedMps: speed,
        altitudeM: 216 + 6 * Math.sin(tick / 20),
        headingDeg: heading,
        accuracyM: 5,
        timestamp: Date.now(),
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [active, ingest]);
}
