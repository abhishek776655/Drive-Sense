import {DeviceMotion} from 'expo-sensors';
import {useEffect} from 'react';
import {useRecordingStore} from '../stores/recordingStore';
import {useSensorDriveStore} from '../stores/sensorDriveStore';
import {lateralG, yawRateRadS} from './sensors/cornering';
import {verticalAccel} from './sensors/roughness';

const SAMPLE_MS = 100;

/**
 * Turn rate and vertical shake from the phone's fused motion sensor while recording (spec
 * 2026-10-25, telemetry sources, section 3): cornering G and road roughness. Gravity comes from the
 * same reading, so the phone can sit any way up.
 */
export function useDeviceMotionFeed(active: boolean): void {
  useEffect(() => {
    if (!active) {
      return;
    }
    let sub: {remove: () => void} | null = null;
    let cancelled = false;
    DeviceMotion.isAvailableAsync()
      .then((ok) => {
        if (!ok || cancelled) {
          return;
        }
        DeviceMotion.setUpdateInterval(SAMPLE_MS);
        sub = DeviceMotion.addListener((m) => {
          const rec = useRecordingStore.getState();
          if (rec.status !== 'recording' || !m.acceleration || !m.rotationRate) {
            return;
          }
          const g = m.accelerationIncludingGravity;
          // Gravity alone: the reading with gravity minus the reading without it.
          const gravity = {x: g.x - m.acceleration.x, y: g.y - m.acceleration.y, z: g.z - m.acceleration.z};
          const where = rec.position ? {latitude: rec.position.latitude, longitude: rec.position.longitude} : null;
          const store = useSensorDriveStore.getState();
          store.addLateralG(lateralG(yawRateRadS(m.rotationRate, gravity), rec.stats.speedMps), Date.now(), where);
          store.addVertical(verticalAccel(m.acceleration, gravity), rec.stats.distanceM, where);
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [active]);
}
