import {useEffect, useRef, useState} from 'react';
import {useDriveFuel} from '../hooks/useDriveMileage';
import {useRange} from '../hooks/useRange';
import {useObdStore} from '../stores/obdStore';
import {usePreferencesStore} from '../stores/preferencesStore';
import {useWeatherStore} from '../stores/weatherStore';
import {elapsedSeconds, useRecordingStore} from '../stores/recordingStore';
import {useActiveVehicle} from '../stores/vehicleStore';
import {clusterData, type ClusterData} from './clusterData';
import {gFrom} from './motion';

/** How much each new G reading moves the shown value (light smoothing of GPS noise). */
const G_SMOOTHING = 0.5;

/**
 * The cluster's data (spec 2026-10-25, cluster mode, section 2), gathered from the stores the rest of
 * the app already keeps. Re-renders on adapter readings and once a second for the clock.
 */
export function useClusterData(): ClusterData {
  const vehicle = useActiveVehicle();
  const values = useObdStore((s) => s.values);
  const derived = useObdStore((s) => s.derived);
  const mil = useObdStore((s) => s.mil);
  // The closed-throttle reading: the lowest this session (it rarely reads 0).
  const closedThrottle = useObdStore((s) => s.throttleLow);
  const battery = useObdStore((s) => s.adapter?.lastState?.battery ?? null);
  const position = useRecordingStore((s) => s.position);
  const speedMps = useRecordingStore((s) => s.stats.speedMps);
  const distanceM = useRecordingStore((s) => s.stats.distanceM);
  const status = useRecordingStore((s) => s.status);
  const startedAt = useRecordingStore((s) => s.startedAt);
  const pausedMs = useRecordingStore((s) => s.pausedMs);
  const pausedAt = useRecordingStore((s) => s.pausedAt);
  const fuelPrice = usePreferencesStore((s) => s.fuelPrice);
  const speedAlert = usePreferencesStore((s) => (s.speedAlert ? s.speedAlertKmh : null));
  const weatherC = useWeatherStore((s) => s.weather?.temperatureC ?? null);
  const headingDeg = useRecordingStore((s) => s.position?.headingDeg ?? null);
  const brakes = useRecordingStore((s) => s.stats.brakeCount);
  const accels = useRecordingStore((s) => s.stats.accelCount);
  const range = useRange(vehicle?.id ?? null, values.fuelLevel?.v);
  const driveFuel = useDriveFuel();

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // G from successive fixes, whatever the phone mount.
  const prev = useRef<{speedMps: number; headingDeg: number | null; at: number} | null>(null);
  const [g, setG] = useState<{lon: number; lat: number} | null>(null);
  useEffect(() => {
    if (!position || position.speedMps == null) {
      return;
    }
    const next = {speedMps: position.speedMps, headingDeg: position.headingDeg, at: position.timestamp};
    const reading = prev.current ? gFrom(prev.current, next) : null;
    prev.current = next;
    if (reading) {
      setG((old) => (old ? {lon: old.lon + (reading.lon - old.lon) * G_SMOOTHING, lat: old.lat + (reading.lat - old.lat) * G_SMOOTHING} : reading));
    }
  }, [position]);

  return clusterData({
    now,
    values,
    derived,
    mil,
    closedThrottle,
    fuel: vehicle?.fuel_type ?? null,
    gpsSpeedMps: speedMps,
    g,
    rangeKm: range.km,
    recording: status === 'ready' ? null : {driveS: elapsedSeconds({startedAt, pausedMs, pausedAt}, now), distanceM},
    driveFuel,
    fuelPrice,
    batteryDipV: battery?.startDipV ?? null,
    weatherC,
    headingDeg,
    events: {brake: brakes, accel: accels},
    speedLimitKmh: speedAlert,
  });
}
