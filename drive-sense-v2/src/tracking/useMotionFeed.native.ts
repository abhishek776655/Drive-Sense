import {Accelerometer} from 'expo-sensors';
import {useEffect} from 'react';
import {useRecordingStore} from '../stores/recordingStore';
import {GRAVITY_MPS2} from '../utils/drivingThresholds';
import {horizontalAccel} from '../utils/motion';

/** Accelerometer sample rate; readings are batched into windows before reaching the store. */
const SAMPLE_MS = 100;
/** Window whose peak is published, so the screen updates ~3x a second, not 10x. */
const WINDOW_MS = 300;

/**
 * Live G and smoothness from the accelerometer, only while recording (saves battery). Each window
 * publishes its peak horizontal acceleration so a short jolt is not averaged away.
 */
export function useMotionFeed(active: boolean): void {
  const ingestMotion = useRecordingStore((s) => s.ingestMotion);

  useEffect(() => {
    if (!active) {
      return;
    }
    let peak = 0;
    let windowStart = Date.now();
    Accelerometer.setUpdateInterval(SAMPLE_MS);
    const subscription = Accelerometer.addListener(({x, y, z}) => {
      // expo-sensors reports in g; convert to m/s² before removing gravity.
      const magnitude = Math.sqrt(x * x + y * y + z * z) * GRAVITY_MPS2;
      const accel = horizontalAccel(magnitude);
      if (accel != null) {
        peak = Math.max(peak, accel);
      }
      const now = Date.now();
      if (now - windowStart >= WINDOW_MS) {
        ingestMotion(peak);
        peak = 0;
        windowStart = now;
      }
    });
    return () => subscription.remove();
  }, [active, ingestMotion]);
}
