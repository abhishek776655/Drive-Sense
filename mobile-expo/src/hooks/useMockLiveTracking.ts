import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {MOCK_LIVE_STREAM, MOCK_LIVE_TRACKING} from '../mocks/trackingData';
import {tripService} from '../services/tripService';

const metersBetween = (
  left: {latitude: number; longitude: number},
  right: {latitude: number; longitude: number},
) => {
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

const toSessionPoints = (sessionStartTime: string) => {
  const baseStart = new Date(MOCK_LIVE_TRACKING.start_time).getTime();
  const liveStart = new Date(sessionStartTime).getTime();

  return MOCK_LIVE_TRACKING.location_points.map((point) => {
    const offset = new Date(point.recorded_at).getTime() - baseStart;
    return {
      ...point,
      recorded_at: new Date(liveStart + offset).toISOString(),
    };
  });
};

type UseMockLiveTrackingOptions = {
  vehicleId?: string;
  vehicleName?: string;
};

export const useMockLiveTracking = ({vehicleId, vehicleName}: UseMockLiveTrackingOptions = {}) => {
  const [isStarted, setIsStarted] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<string | null>(null);
  const [backendTripId, setBackendTripId] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<'idle' | 'starting' | 'recording' | 'syncing' | 'local_only' | 'saved' | 'error'>('idle');
  const [acceptedPoints, setAcceptedPoints] = useState(0);
  const [acceptedEvents, setAcceptedEvents] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [completedTrip, setCompletedTrip] = useState<{
    endedAt: string;
    distanceLabel: string;
    durationLabel: string;
    eventCount: number;
  } | null>(null);
  const autoStartedRef = useRef(false);
  const lastSentCountRef = useRef(0);

  const allSessionPoints = useMemo(
    () => (sessionStartTime ? toSessionPoints(sessionStartTime) : []),
    [sessionStartTime],
  );

  useEffect(() => {
    if (!isStarted || allSessionPoints.length === 0) {
      return;
    }

    const interval = setInterval(() => {
      setFrameIndex((current) => {
        const nextFrame = Math.min(current + 1, MOCK_LIVE_STREAM.length - 1);
        return nextFrame;
      });
    }, 2600);

    return () => clearInterval(interval);
  }, [allSessionPoints.length, isStarted]);

  const startTrip = useCallback(async () => {
    if (isStarted) {
      return;
    }

    const startedAt = new Date().toISOString();
    setIsStarted(true);
    setHasEnded(false);
    setCompletedTrip(null);
    setFrameIndex(0);
    setSessionStartTime(startedAt);
    setAcceptedPoints(0);
    setAcceptedEvents(0);
    setSyncError(null);
    lastSentCountRef.current = 0;

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
      setBackendTripId(null);
      setSyncState('local_only');
      setSyncError(error instanceof Error ? error.message : 'Unable to start backend recording');
    }
  }, [isStarted, vehicleId]);

  useEffect(() => {
    if (autoStartedRef.current || isStarted) {
      return;
    }

    const firstPoint = MOCK_LIVE_TRACKING.location_points[0];
    if (!firstPoint?.is_moving) {
      return;
    }

    autoStartedRef.current = true;
    void startTrip();
  }, [isStarted, startTrip]);

  const liveFrames = isStarted ? MOCK_LIVE_STREAM : [MOCK_LIVE_STREAM[0]];
  const frame = liveFrames[Math.min(frameIndex, liveFrames.length - 1)];
  const pointCount = isStarted ? frame.pointCount : 1;
  const locationPoints = isStarted ? allSessionPoints.slice(0, pointCount) : [];
  const seededPoint = sessionStartTime ? allSessionPoints[0] : MOCK_LIVE_TRACKING.location_points[0];
  const currentPoint = locationPoints[locationPoints.length - 1] ?? seededPoint;
  const startTime = sessionStartTime ?? new Date().toISOString();

  useEffect(() => {
    if (!backendTripId || locationPoints.length === 0) {
      return;
    }

    const unsentPoints = locationPoints.slice(lastSentCountRef.current);
    if (unsentPoints.length === 0) {
      return;
    }

    let cancelled = false;

    const syncPoints = async () => {
      try {
        setSyncState('syncing');
        const response = await tripService.sendLocations(backendTripId, unsentPoints);
        if (cancelled) {
          return;
        }
        lastSentCountRef.current = locationPoints.length;
        setAcceptedPoints((current) => current + response.accepted_points);
        setSyncState('recording');
      } catch (error) {
        if (cancelled) {
          return;
        }
        setSyncState('error');
        setSyncError(error instanceof Error ? error.message : 'Location sync failed');
      }
    };

    void syncPoints();

    return () => {
      cancelled = true;
    };
  }, [backendTripId, locationPoints]);

  const totalDistanceMeters = useMemo(() => {
    return locationPoints.slice(1).reduce((sum, point, index) => {
      return sum + metersBetween(locationPoints[index], point);
    }, 0);
  }, [locationPoints]);

  const startDate = new Date(startTime);
  const currentTime = new Date(currentPoint.recorded_at);
  const durationMinutes = Math.max(0, Math.round((currentTime.getTime() - startDate.getTime()) / 60000));
  const avgSpeedMps =
    locationPoints.length > 0
      ? locationPoints.reduce((sum, point) => sum + point.speed_mps, 0) / locationPoints.length
      : 0;
  const maxSpeedMps = locationPoints.length > 0 ? Math.max(...locationPoints.map((point) => point.speed_mps)) : 0;
  const dataState =
    hasEnded ? 'ended' : !isStarted ? 'ready' : currentPoint.is_moving ? 'moving' : 'idle';
  const prominentStatus = hasEnded ? 'Trip Saved' : !isStarted ? 'Trip Ready' : currentPoint.is_moving ? 'Trip Started • Moving' : 'Trip Started • Idle';
  const syncLabel =
    syncState === 'starting'
      ? 'Starting trip'
      : syncState === 'syncing'
        ? 'Updating live trip'
        : syncState === 'recording'
          ? 'Live trip active'
          : syncState === 'saved'
            ? 'Trip saved to history'
          : syncState === 'local_only'
            ? 'Live trip active'
            : syncState === 'error'
              ? 'Live update paused'
              : 'Ready for live tracking';

  useEffect(() => {
    if (!isStarted || hasEnded || allSessionPoints.length === 0) {
      return;
    }

    if (frameIndex < MOCK_LIVE_STREAM.length - 1) {
      return;
    }

    const endedAt = currentPoint.recorded_at;
    setIsStarted(false);
    setHasEnded(true);
    setSyncState('saved');
    setAcceptedEvents(frame.events);
    setCompletedTrip({
      endedAt,
      distanceLabel: `${(totalDistanceMeters / 1000).toFixed(1)} km`,
      durationLabel: `${durationMinutes} min`,
      eventCount: frame.events,
    });
  }, [allSessionPoints.length, currentPoint.recorded_at, durationMinutes, frame.events, frameIndex, hasEnded, isStarted, totalDistanceMeters]);

  return {
    ...MOCK_LIVE_TRACKING,
    trip_id: backendTripId ?? MOCK_LIVE_TRACKING.trip_id,
    state: dataState,
    start_time: startTime,
    vehicleName: vehicleName ?? MOCK_LIVE_TRACKING.vehicleName,
    frameIndex,
    location_points: locationPoints,
    currentLocation: frame.currentLocation,
    speed: Math.round(currentPoint.speed_mps * 3.6),
    distance: `${(totalDistanceMeters / 1000).toFixed(1)} km`,
    duration: `${durationMinutes} min`,
    progress: locationPoints.length / Math.max(1, allSessionPoints.length),
    heading: `${Math.round(currentPoint.heading_deg)}°`,
    paceDelta: frame.harshBrake,
    currentPoint,
    hasLiveLocation: true,
    isStarted,
    hasEnded,
    prominentStatus,
    syncLabel,
    syncState,
    acceptedPoints,
    acceptedEvents,
    syncError,
    completedTrip,
    startTrip,
    stats: [
      {label: 'avg_speed_mps', value: avgSpeedMps.toFixed(1)},
      {label: 'max_speed_mps', value: maxSpeedMps.toFixed(1)},
      {label: 'accuracy_m', value: currentPoint.accuracy_m.toFixed(1)},
      {label: 'accepted_points', value: String(acceptedPoints)},
    ],
    timeline: [
      {label: 'recorded_at', value: currentPoint.recorded_at.slice(11, 19)},
      {label: 'provider', value: currentPoint.provider},
      {label: 'sync', value: syncLabel},
      {label: 'fuel_used_liters', value: `${frame.fuelBurn.toFixed(1)}`},
    ],
  };
};
