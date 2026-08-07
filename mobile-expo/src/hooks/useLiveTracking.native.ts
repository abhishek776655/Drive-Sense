import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as Location from 'expo-location';
import {Accelerometer} from 'expo-sensors';
import {MOCK_LIVE_TRACKING} from '../mocks/trackingData';
import {tripService} from '../services/tripService';
import {useDashboardStore} from '../store/dashboardStore';
import {GRAVITY_MPS2, HARSH_BRAKE_MPS2, RAPID_ACCELERATION_MPS2} from '../utils/drivingThresholds';

type TrackingPoint = {
  recorded_at: string;
  latitude: number;
  longitude: number;
  speed_mps: number;
  heading_deg: number;
  accuracy_m: number;
  altitude_m: number;
  is_moving: boolean;
  provider: string;
};

type TrackingEvent = {
  event_type: 'harsh_brake' | 'rapid_acceleration' | 'overspeed';
  intensity: number;
  occurred_at: string;
  latitude: number;
  longitude: number;
  payload: Record<string, unknown>;
};

type CompletedTripSummary = {
  endedAt: string;
  distanceLabel: string;
  durationLabel: string;
  eventCount: number;
};

const OVERSPEED_MPS = 27.78;
const AUTO_START_SPEED_MPS = 2.2;
const AUTO_END_IDLE_SECONDS = 180;
const MAX_ACCEPTABLE_ACCURACY_M = 55;
const MAX_STATIONARY_DRIFT_METERS = 24;
const STABLE_IDLE_POINT_COUNT = 4;
const STABLE_IDLE_RADIUS_METERS = 18;

const metersBetween = (left: TrackingPoint, right: TrackingPoint) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const deltaLat = toRad(right.latitude - left.latitude);
  const deltaLng = toRad(right.longitude - left.longitude);
  const lat1 = toRad(left.latitude);
  const lat2 = toRad(right.latitude);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

const normalizeHeading = (value: number) => {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

const headingDelta = (from: number, to: number) => {
  const delta = normalizeHeading(to) - normalizeHeading(from);
  if (delta > 180) {
    return delta - 360;
  }
  if (delta < -180) {
    return delta + 360;
  }
  return delta;
};

const smoothHeading = (from: number, to: number, factor: number) => {
  return normalizeHeading(from + headingDelta(from, to) * factor);
};

// `fallbackHeading` is null until we have any real heading reading (compass or GPS-derived).
// Using null instead of overloading 0 avoids treating a genuine due-north reading as "uninitialized".
const resolveHeading = (fallbackHeading: number | null, rawHeading: number, smoothingFactor: number) => {
  if (fallbackHeading == null) {
    return normalizeHeading(rawHeading);
  }
  return smoothHeading(fallbackHeading, rawHeading, smoothingFactor);
};

const bearingBetween = (left: TrackingPoint, right: Location.LocationObject['coords']) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const toDeg = (value: number) => (value * 180) / Math.PI;
  const lat1 = toRad(left.latitude);
  const lat2 = toRad(right.latitude);
  const deltaLng = toRad(right.longitude - left.longitude);
  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  return normalizeHeading(toDeg(Math.atan2(y, x)));
};

const toTrackingPoint = (
  location: Location.LocationObject,
  fallbackHeading: number | null,
  previousPoint: TrackingPoint | null,
): TrackingPoint => {
  const {coords, timestamp} = location;
  const speed = Math.max(0, coords.speed ?? 0);
  const hasNativeHeading = typeof coords.heading === 'number' && coords.heading >= 0;
  const movedEnough =
    previousPoint != null
      ? metersBetween(previousPoint, {
          recorded_at: new Date(timestamp).toISOString(),
          latitude: coords.latitude,
          longitude: coords.longitude,
          speed_mps: speed,
          heading_deg: 0,
          accuracy_m: Math.max(0, coords.accuracy ?? 0),
          altitude_m: coords.altitude ?? 0,
          is_moving: speed >= 0.8,
          provider: 'device_gps',
        }) > 4
      : false;
  const derivedBearing = previousPoint && movedEnough ? bearingBetween(previousPoint, coords) : null;
  const rawHeading = hasNativeHeading && speed >= 1 ? coords.heading! : derivedBearing ?? fallbackHeading ?? 0;
  const resolvedHeading = resolveHeading(fallbackHeading, rawHeading, 0.42);

  return {
    recorded_at: new Date(timestamp).toISOString(),
    latitude: coords.latitude,
    longitude: coords.longitude,
    speed_mps: speed,
    heading_deg: normalizeHeading(resolvedHeading),
    accuracy_m: Math.max(0, coords.accuracy ?? 0),
    altitude_m: coords.altitude ?? 0,
    is_moving: speed >= 0.8,
    provider: 'device_gps',
  };
};

const getTripMetrics = (points: TrackingPoint[], startTime: string) => {
  const totalDistanceMeters = points.slice(1).reduce((sum, point, index) => sum + metersBetween(points[index], point), 0);
  const lastRecordedAt = points[points.length - 1]?.recorded_at ?? startTime;
  const durationSeconds = Math.max(
    0,
    Math.round((new Date(lastRecordedAt).getTime() - new Date(startTime).getTime()) / 1000),
  );

  return {
    totalDistanceMeters,
    durationSeconds,
    lastRecordedAt,
  };
};

const hasStableIdleCluster = (points: TrackingPoint[]) => {
  if (points.length < STABLE_IDLE_POINT_COUNT) {
    return false;
  }

  const cluster = points.slice(-STABLE_IDLE_POINT_COUNT);
  const anchor = cluster[0];
  return cluster.every((point) => {
    const withinRadius = metersBetween(anchor, point) <= STABLE_IDLE_RADIUS_METERS;
    const nearStopped = point.speed_mps <= 0.6 && !point.is_moving;
    return withinRadius && nearStopped;
  });
};

type UseLiveTrackingOptions = {
  vehicleId?: string;
  vehicleName?: string;
};

export const useLiveTracking = ({vehicleId, vehicleName}: UseLiveTrackingOptions = {}) => {
  const fetchDashboard = useDashboardStore((state) => state.fetchDashboard);
  const [permissionState, setPermissionState] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [sessionStartTime, setSessionStartTime] = useState<string | null>(null);
  const [backendTripId, setBackendTripId] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<'idle' | 'starting' | 'recording' | 'syncing' | 'local_only' | 'saved' | 'error'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [acceptedPoints, setAcceptedPoints] = useState(0);
  const [acceptedEvents, setAcceptedEvents] = useState(0);
  const [points, setPoints] = useState<TrackingPoint[]>([]);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [latestAcceleration, setLatestAcceleration] = useState({x: 0, y: 0, z: 0, magnitude: 0});
  const [isStarted, setIsStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [completedTrip, setCompletedTrip] = useState<CompletedTripSummary | null>(null);

  const isStartedRef = useRef(false);
  const isPausedRef = useRef(false);
  const hasEndedRef = useRef(false);
  const hasOverspeededRef = useRef(false);
  const lastSentPointCountRef = useRef(0);
  const lastSentEventCountRef = useRef(0);
  const sendingPointsRef = useRef(false);
  const sendingEventsRef = useRef(false);
  const watchSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const headingSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const latestHeadingRef = useRef<number | null>(null);
  const latestPointRef = useRef<TrackingPoint | null>(null);
  const pointsRef = useRef<TrackingPoint[]>([]);
  const endingTripRef = useRef(false);
  const lastMovementAtRef = useRef<string | null>(null);
  const isUnmountedRef = useRef(false);

  useEffect(() => {
    isStartedRef.current = isStarted;
  }, [isStarted]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    hasEndedRef.current = hasEnded;
  }, [hasEnded]);

  const pushEvent = useCallback((event: TrackingEvent) => {
    setEvents((current) => [...current, event]);
  }, []);

  const startTrip = useCallback(
    async (startedAt: string) => {
      if (isStartedRef.current) {
        return;
      }

      setCompletedTrip(null);
      setHasEnded(false);
      setIsPaused(false);
      isPausedRef.current = false;
      hasEndedRef.current = false;
      isStartedRef.current = true;
      setIsStarted(true);
      setSessionStartTime(startedAt);
      setSyncError(null);
      setEvents([]);
      setAcceptedPoints(0);
      setAcceptedEvents(0);
      lastSentPointCountRef.current = 0;
      lastSentEventCountRef.current = 0;
      lastMovementAtRef.current = startedAt;

      if (pointsRef.current.length > 0) {
        const seedPoint = pointsRef.current[pointsRef.current.length - 1];
        latestPointRef.current = seedPoint;
        pointsRef.current = [seedPoint];
        setPoints(pointsRef.current);
      }

      if (!vehicleId) {
        setSyncState('local_only');
        return;
      }

      try {
        setSyncState('starting');
        const trip = await tripService.startTrip(vehicleId, startedAt);
        setBackendTripId(trip.id);
        setSyncState('recording');
      } catch (error) {
        setSyncState('local_only');
        setSyncError(error instanceof Error ? error.message : 'Unable to start trip in backend');
      }
    },
    [vehicleId],
  );

  const finalizeTrip = useCallback(
    async (endedAt: string, nextPoints: TrackingPoint[]) => {
      if (endingTripRef.current || !isStartedRef.current || hasEndedRef.current) {
        return;
      }

      endingTripRef.current = true;
      const metrics = getTripMetrics(nextPoints, sessionStartTime ?? nextPoints[0]?.recorded_at ?? endedAt);

      try {
        if (backendTripId) {
          const unsentPoints = nextPoints.slice(lastSentPointCountRef.current);
          if (unsentPoints.length > 0) {
            const locationResponse = await tripService.sendLocations(backendTripId, unsentPoints, false);
            lastSentPointCountRef.current = nextPoints.length;
            setAcceptedPoints((current) => current + locationResponse.accepted_points);
          }

          const unsentEvents = events.slice(lastSentEventCountRef.current);
          if (unsentEvents.length > 0) {
            const eventResponse = await tripService.sendEvents(backendTripId, unsentEvents);
            lastSentEventCountRef.current = events.length;
            setAcceptedEvents((current) => current + eventResponse.accepted_events);
          }
        }

        if (vehicleId) {
          await tripService.endTrip({
            vehicle_id: vehicleId,
            end_time: endedAt,
            distance_meters: metrics.totalDistanceMeters,
            duration_seconds: metrics.durationSeconds,
          });
        }
        await fetchDashboard();
        setSyncState((current) => (current === 'error' ? current : 'saved'));
        setBackendTripId(null);
        setIsStarted(false);
        setIsPaused(false);
        isPausedRef.current = false;
        isStartedRef.current = false;
        setHasEnded(true);
        hasEndedRef.current = true;
        setCompletedTrip({
          endedAt,
          distanceLabel: `${(metrics.totalDistanceMeters / 1000).toFixed(1)} km`,
          durationLabel:
            metrics.durationSeconds >= 3600
              ? `${Math.floor(metrics.durationSeconds / 3600)}h ${Math.floor((metrics.durationSeconds % 3600) / 60)}m`
              : `${Math.floor(metrics.durationSeconds / 60)}m`,
          eventCount: events.length,
        });
      } catch (error) {
        setSyncState('error');
        setSyncError(error instanceof Error ? error.message : 'Unable to end trip in backend');
      } finally {
        endingTripRef.current = false;
      }
    },
    [backendTripId, events, fetchDashboard, sessionStartTime, vehicleId],
  );

  const pauseTrip = useCallback(() => {
    if (!isStartedRef.current || hasEndedRef.current) {
      return;
    }
    setIsPaused((current) => {
      const nextPaused = !current;
      isPausedRef.current = nextPaused;
      if (!nextPaused) {
        // Resuming: restart the idle clock so a long pause doesn't read as idle time and
        // immediately trip the auto-end-on-idle check on the next stationary point.
        lastMovementAtRef.current = new Date().toISOString();
      }
      return nextPaused;
    });
  }, []);

  const endTrip = useCallback(() => {
    const endedAt = latestPointRef.current?.recorded_at ?? new Date().toISOString();
    void finalizeTrip(endedAt, pointsRef.current);
  }, [finalizeTrip]);

  // Side effects (event detection, trip start/end, backend sync triggers) run as plain sequential
  // code here, never inside a setState updater function — updater functions must stay pure, since
  // React is free to re-invoke them (e.g. under StrictMode), which would double-fire everything below.
  const handleLocationPoint = useCallback(
    (point: TrackingPoint) => {
      const previous = latestPointRef.current;

      if (point.accuracy_m > MAX_ACCEPTABLE_ACCURACY_M && previous) {
        return;
      }

      if (previous) {
        const distanceMeters = metersBetween(previous, point);
        const deltaSecondsForFilter =
          (new Date(point.recorded_at).getTime() - new Date(previous.recorded_at).getTime()) / 1000;

        if (deltaSecondsForFilter > 0) {
          const maxExpectedDistance =
            Math.max(MAX_STATIONARY_DRIFT_METERS, Math.max(previous.speed_mps, point.speed_mps) * deltaSecondsForFilter * 3.2);

          if (distanceMeters > maxExpectedDistance && point.accuracy_m > previous.accuracy_m) {
            return;
          }
        }
      }

      latestPointRef.current = point;

      if (isPausedRef.current) {
        if (pointsRef.current.length === 0) {
          pointsRef.current = [point];
          setPoints(pointsRef.current);
        }
        return;
      }

      const nextPoints = [...pointsRef.current, point];
      pointsRef.current = nextPoints;

      if (point.is_moving || point.speed_mps >= 0.8) {
        lastMovementAtRef.current = point.recorded_at;
      }

      if (!isStartedRef.current && point.speed_mps >= AUTO_START_SPEED_MPS) {
        void startTrip(point.recorded_at);
      }

      if (previous) {
        const deltaSeconds =
          (new Date(point.recorded_at).getTime() - new Date(previous.recorded_at).getTime()) / 1000;
        if (deltaSeconds > 0) {
          const accelerationMps2 = (point.speed_mps - previous.speed_mps) / deltaSeconds;
          if (accelerationMps2 >= RAPID_ACCELERATION_MPS2) {
            pushEvent({
              event_type: 'rapid_acceleration',
              intensity: Number((accelerationMps2 / RAPID_ACCELERATION_MPS2).toFixed(3)),
              occurred_at: point.recorded_at,
              latitude: point.latitude,
              longitude: point.longitude,
              payload: {
                speed_mps: point.speed_mps,
                previous_speed_mps: previous.speed_mps,
                acceleration_mps2: Number(accelerationMps2.toFixed(3)),
                delta_seconds: Number(deltaSeconds.toFixed(3)),
                sensor_acceleration_mps2: Number(latestAcceleration.magnitude.toFixed(3)),
              },
            });
          } else if (accelerationMps2 <= HARSH_BRAKE_MPS2) {
            pushEvent({
              event_type: 'harsh_brake',
              intensity: Number((Math.abs(accelerationMps2) / Math.abs(HARSH_BRAKE_MPS2)).toFixed(3)),
              occurred_at: point.recorded_at,
              latitude: point.latitude,
              longitude: point.longitude,
              payload: {
                speed_mps: point.speed_mps,
                previous_speed_mps: previous.speed_mps,
                acceleration_mps2: Number(accelerationMps2.toFixed(3)),
                delta_seconds: Number(deltaSeconds.toFixed(3)),
                sensor_acceleration_mps2: Number(latestAcceleration.magnitude.toFixed(3)),
              },
            });
          }
        }
      }

      if (point.speed_mps > OVERSPEED_MPS) {
        if (!hasOverspeededRef.current) {
          hasOverspeededRef.current = true;
          pushEvent({
            event_type: 'overspeed',
            intensity: Number((point.speed_mps / OVERSPEED_MPS).toFixed(3)),
            occurred_at: point.recorded_at,
            latitude: point.latitude,
            longitude: point.longitude,
            payload: {
              speed_mps: point.speed_mps,
              speed_kph: Number((point.speed_mps * 3.6).toFixed(2)),
              threshold_mps: OVERSPEED_MPS,
            },
          });
        }
      } else {
        hasOverspeededRef.current = false;
      }

      setPoints(nextPoints);

      if (
        isStartedRef.current &&
        !isPausedRef.current &&
        !hasEndedRef.current &&
        !point.is_moving &&
        lastMovementAtRef.current &&
        (new Date(point.recorded_at).getTime() - new Date(lastMovementAtRef.current).getTime()) / 1000 >= AUTO_END_IDLE_SECONDS &&
        hasStableIdleCluster(nextPoints)
      ) {
        void finalizeTrip(point.recorded_at, nextPoints);
      }
    },
    [finalizeTrip, latestAcceleration.magnitude, pushEvent, startTrip],
  );

  const startWatchers = useCallback(async () => {
    if (watchSubscriptionRef.current) {
      return;
    }

    try {
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (isUnmountedRef.current) {
        return;
      }
      handleLocationPoint(toTrackingPoint(currentLocation, latestHeadingRef.current, latestPointRef.current));
    } catch (error) {
      if (!isUnmountedRef.current) {
        setSyncError(error instanceof Error ? error.message : 'Unable to read current location');
      }
    }

    const headingSubscription = await Location.watchHeadingAsync((heading) => {
      const nextHeading =
        heading.trueHeading >= 0 ? heading.trueHeading : heading.magHeading >= 0 ? heading.magHeading : 0;
      const resolvedHeading = resolveHeading(latestHeadingRef.current, nextHeading, 0.28);
      latestHeadingRef.current = resolvedHeading;

      if (pointsRef.current.length === 0) {
        return;
      }

      const lastPoint = pointsRef.current[pointsRef.current.length - 1];
      const delta = Math.abs(headingDelta(lastPoint.heading_deg, resolvedHeading));
      if (delta < 2.5) {
        return;
      }

      const nextPoints = [...pointsRef.current];
      nextPoints[nextPoints.length - 1] = {
        ...lastPoint,
        heading_deg: resolvedHeading,
      };
      pointsRef.current = nextPoints;
      latestPointRef.current = nextPoints[nextPoints.length - 1];
      setPoints(nextPoints);
    });

    if (isUnmountedRef.current) {
      headingSubscription.remove();
      return;
    }
    headingSubscriptionRef.current = headingSubscription;

    const positionSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 3000,
        distanceInterval: 5,
        mayShowUserSettingsDialog: true,
      },
      (location) => {
        handleLocationPoint(toTrackingPoint(location, latestHeadingRef.current, latestPointRef.current));
      },
    );

    if (isUnmountedRef.current) {
      positionSubscription.remove();
      return;
    }
    watchSubscriptionRef.current = positionSubscription;
  }, [handleLocationPoint]);

  const requestLocationAccess = useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (isUnmountedRef.current) {
      return;
    }

    if (permission.status !== 'granted') {
      setPermissionState('denied');
      setSyncState('error');
      setSyncError('Location permission denied');
      return;
    }

    setPermissionState('granted');
    setSyncError((current) => (current === 'Location permission denied' ? null : current));
    setSyncState((current) => (current === 'error' ? 'idle' : current));
    await startWatchers();
  }, [startWatchers]);

  useEffect(() => {
    isUnmountedRef.current = false;
    void requestLocationAccess();

    Accelerometer.setUpdateInterval(800);

    return () => {
      isUnmountedRef.current = true;
      watchSubscriptionRef.current?.remove();
      watchSubscriptionRef.current = null;
      headingSubscriptionRef.current?.remove();
      headingSubscriptionRef.current = null;
    };
  }, [requestLocationAccess]);

  // Accelerometer output is cosmetic only (paceDelta label + event payload metadata) — actual
  // event detection is pure GPS speed-delta. Only sample it while a trip is active to save battery.
  useEffect(() => {
    if (!isStarted) {
      return;
    }

    const accelerometerSubscription = Accelerometer.addListener((reading) => {
      const magnitude = Math.sqrt(reading.x ** 2 + reading.y ** 2 + reading.z ** 2) * 9.81;
      setLatestAcceleration({
        x: Number(reading.x.toFixed(4)),
        y: Number(reading.y.toFixed(4)),
        z: Number(reading.z.toFixed(4)),
        magnitude: Number(magnitude.toFixed(3)),
      });
    });

    return () => {
      accelerometerSubscription.remove();
    };
  }, [isStarted]);

  useEffect(() => {
    if (!backendTripId || points.length === 0 || sendingPointsRef.current) {
      return;
    }

    const unsentPoints = points.slice(lastSentPointCountRef.current);
    if (unsentPoints.length === 0) {
      return;
    }

    let cancelled = false;
    sendingPointsRef.current = true;

    const syncPoints = async () => {
      try {
        setSyncState('syncing');
        const response = await tripService.sendLocations(backendTripId, unsentPoints, false);
        if (cancelled) {
          return;
        }
        lastSentPointCountRef.current = points.length;
        setAcceptedPoints((current) => current + response.accepted_points);
        setSyncState('recording');
      } catch (error) {
        if (!cancelled) {
          setSyncState('error');
          setSyncError(error instanceof Error ? error.message : 'Failed to sync location points');
        }
      } finally {
        sendingPointsRef.current = false;
      }
    };

    void syncPoints();

    return () => {
      cancelled = true;
    };
  }, [backendTripId, points]);

  useEffect(() => {
    if (!backendTripId || events.length === 0 || sendingEventsRef.current) {
      return;
    }

    const unsentEvents = events.slice(lastSentEventCountRef.current);
    if (unsentEvents.length === 0) {
      return;
    }

    let cancelled = false;
    sendingEventsRef.current = true;

    const syncEvents = async () => {
      try {
        const response = await tripService.sendEvents(backendTripId, unsentEvents);
        if (cancelled) {
          return;
        }
        lastSentEventCountRef.current = events.length;
        setAcceptedEvents((current) => current + response.accepted_events);
      } catch (error) {
        if (!cancelled) {
          setSyncState('error');
          setSyncError(error instanceof Error ? error.message : 'Failed to sync events');
        }
      } finally {
        sendingEventsRef.current = false;
      }
    };

    void syncEvents();

    return () => {
      cancelled = true;
    };
  }, [backendTripId, events]);

  // Keep showing the full route while a trip is active, and also right after it ends so the
  // just-finished route doesn't vanish the instant the "trip saved" card appears.
  const visiblePoints = useMemo(() => {
    if (isStarted || completedTrip) {
      return points;
    }
    return points.length > 0 ? [points[points.length - 1]] : [];
  }, [isStarted, completedTrip, points]);

  const hasLiveLocation = points.length > 0;
  const currentPoint = visiblePoints[visiblePoints.length - 1] ?? points[points.length - 1] ?? null;
  const resolvedPoint =
    currentPoint ?? {
      recorded_at: new Date().toISOString(),
      latitude: 0,
      longitude: 0,
      speed_mps: 0,
      heading_deg: 0,
      accuracy_m: 0,
      altitude_m: 0,
      is_moving: false,
      provider: 'pending',
    };
  const startTime = sessionStartTime ?? resolvedPoint.recorded_at;
  const totalDistanceMeters = useMemo(() => {
    return visiblePoints.slice(1).reduce((sum, point, index) => sum + metersBetween(visiblePoints[index], point), 0);
  }, [visiblePoints]);
  const durationMinutes = Math.max(
    0,
    Math.round((new Date(resolvedPoint.recorded_at).getTime() - new Date(startTime).getTime()) / 60000),
  );
  const avgSpeedMps =
    visiblePoints.length > 0
      ? visiblePoints.reduce((sum, point) => sum + point.speed_mps, 0) / visiblePoints.length
      : 0;
  const maxSpeedMps = visiblePoints.length > 0 ? Math.max(...visiblePoints.map((point) => point.speed_mps)) : 0;
  const fuelUsedLiters = totalDistanceMeters / 15000;
  const currentLocation = hasLiveLocation
    ? `Lat ${resolvedPoint.latitude.toFixed(4)}, Lng ${resolvedPoint.longitude.toFixed(4)}`
    : 'Waiting for live GPS fix';
  const lastEvent = events[events.length - 1];

  const state = hasEnded ? 'ready' : isPaused ? 'paused' : !isStarted ? 'ready' : resolvedPoint.is_moving ? 'moving' : 'idle';
  const prominentStatus = hasEnded
    ? 'Waiting for Movement'
    : isPaused
      ? 'Trip Paused'
    : !hasLiveLocation
      ? 'Waiting for Location'
      : !isStarted
        ? 'Waiting for Movement'
        : resolvedPoint.is_moving
          ? 'Trip Started • Moving'
          : 'Trip Started • Idle';
  const syncLabel =
    permissionState === 'denied'
      ? 'Location access needed'
      : hasEnded
        ? 'Ready for live tracking'
        : isPaused
          ? 'Trip paused'
        : syncState === 'starting'
          ? 'Starting trip'
        : syncState === 'syncing'
          ? 'Updating live trip'
        : syncState === 'recording'
          ? 'Live trip active'
        : syncState === 'local_only'
            ? 'Live trip active'
            : syncState === 'saved'
              ? 'Trip saved to history'
            : syncState === 'error'
              ? 'Live update paused'
              : 'Ready for live tracking';

  return {
    ...MOCK_LIVE_TRACKING,
    trip_id: backendTripId ?? MOCK_LIVE_TRACKING.trip_id,
    state,
    start_time: startTime,
    vehicleName: vehicleName ?? MOCK_LIVE_TRACKING.vehicleName,
    statusLabel: state,
    hasLiveLocation,
    location_points: visiblePoints,
    currentPoint: resolvedPoint,
    currentLocation,
    speed: Math.round(resolvedPoint.speed_mps * 3.6),
    distance: `${(totalDistanceMeters / 1000).toFixed(1)} km`,
    duration: `${durationMinutes} min`,
    progress: 1,
    heading: `${Math.round(resolvedPoint.heading_deg)}°`,
    paceDelta: lastEvent ? `${lastEvent.event_type.replace('_', ' ')} detected` : `${latestAcceleration.magnitude.toFixed(1)} m/s² motion`,
    latestAcceleration: latestAcceleration.magnitude,
    isStarted,
    isPaused,
    hasEnded,
    prominentStatus,
    syncLabel,
    syncState,
    acceptedPoints,
    acceptedEvents,
    syncError,
    completedTrip,
    permissionState,
    retryLocationPermission: requestLocationAccess,
    startTrip: () => startTrip(new Date().toISOString()),
    pauseTrip,
    endTrip,
    stats: [
      {label: 'avg_speed_mps', value: avgSpeedMps.toFixed(1)},
      {label: 'max_speed_mps', value: maxSpeedMps.toFixed(1)},
      {label: 'accuracy_m', value: resolvedPoint.accuracy_m.toFixed(1)},
      {label: 'accepted_events', value: String(acceptedEvents)},
    ],
    timeline: [
      {label: 'recorded_at', value: resolvedPoint.recorded_at.slice(11, 19)},
      {label: 'provider', value: resolvedPoint.provider},
      {label: 'sync', value: syncLabel},
      {label: 'fuel_used_liters', value: fuelUsedLiters.toFixed(1)},
    ],
  };
};
