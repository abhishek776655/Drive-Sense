import {create} from 'zustand';
import {usePreferencesStore} from './preferencesStore';
import {isUsableFix, nextSpeedAlert, shouldAutoEnd, shouldAutoStart, type SpeedAlertState} from '../utils/autoTrip';
import {RAPID_ACCELERATION_MPS2, HARSH_BRAKE_MPS2} from '../utils/drivingThresholds';
import {haversineMeters} from '../utils/geo';
import {MOVING_MPS, resolveHeading} from '../utils/heading';
import {liveScore} from '../utils/liveScore';
import {smoothnessFor, toG, type Smoothness} from '../utils/motion';

export type RecordingStatus = 'ready' | 'recording' | 'paused';
export type LocationPermission = 'unknown' | 'granted' | 'denied';
export type DriveEventKind = 'rapid_acceleration' | 'harsh_brake' | 'overspeed';
/** Server sync of the live trip: `offline` keeps queueing points and retries. */
export type SyncState = 'idle' | 'syncing' | 'live' | 'offline' | 'local';

export const OVERSPEED_MPS = 27.78;
/** GPS jitter below this is not counted as distance. */
const MIN_STEP_M = 2;
/** A step implying more than this (~250 km/h) is a GPS jump, not driving, and is not counted. */
const MAX_PLAUSIBLE_MPS = 70;
/**
 * A speed reading that implies more than this acceleration from the previous fix (≈0.9 g, beyond any
 * road car) is a GPS spike: it still shows as the live speed but never becomes the top speed.
 */
const MAX_PLAUSIBLE_ACCEL_MPS2 = 9;
/** Moving time only counts gaps up to this long, so a dropped GPS signal is not counted as driving. */
const MAX_MOVING_GAP_S = 5;
/** Elevation gain ignores altitude noise smaller than this. */
const ALT_SMOOTH_M = 3;
/** Fixes kept for the auto-end "parked" check. */
const RECENT_FIXES = 4;
/**
 * A fix older than this is a cached or replayed position, not the car now. It still updates the
 * screen but never starts or ends a drive: a stale timestamp would make the idle clock read minutes
 * of parking that never happened.
 */
const FRESH_FIX_MS = 15_000;
/** Consecutive fast fixes needed to auto-start, so one bad fix cannot start a drive. */
const AUTO_START_FIXES = 2;

export interface Sample {
  latitude: number;
  longitude: number;
  speedMps: number | null;
  altitudeM: number | null;
  headingDeg: number | null;
  accuracyM: number | null;
  timestamp: number;
  /** Peak motion-sensor G since the previous recorded fix; null when no sensor reading came in. */
  peakG?: number | null;
}

export interface LiveStats {
  speedMps: number;
  distanceM: number;
  topSpeedMps: number | null;
  altitudeM: number | null;
  elevationGainM: number;
  /** Smoothed direction of travel, held while stopped; null until the car has moved. */
  headingDeg: number | null;
  moving: boolean;
  accuracyM: number | null;
  eventCount: number;
  brakeCount: number;
  accelCount: number;
  /** Σ speed ÷ limit at each overspeed entry, as the server scores it. */
  overspeedIntensity: number;
  /** Time spent moving (stops at lights excluded), for average speed. */
  movingSeconds: number;
  liveG: number | null;
  maxG: number | null;
  smoothness: Smoothness | null;
}

export const EMPTY_STATS: LiveStats = {
  speedMps: 0,
  distanceM: 0,
  topSpeedMps: null,
  altitudeM: null,
  elevationGainM: 0,
  headingDeg: null,
  moving: false,
  accuracyM: null,
  eventCount: 0,
  brakeCount: 0,
  accelCount: 0,
  overspeedIntensity: 0,
  movingSeconds: 0,
  liveG: null,
  maxG: null,
  smoothness: null,
};

export interface DriveVehicle {
  id: string;
  name: string;
}

/** Snapshot of a drive at End: what the summary shows and what is left to send to the server. */
export interface FinishedDrive {
  vehicle: DriveVehicle | null;
  /** Server trip, when one was started during the drive; null if it never reached the server. */
  tripId: string | null;
  startedAt: number;
  endedAt: number;
  /** Moving time: paused time excluded. */
  durationSeconds: number;
  distanceM: number;
  topSpeedMps: number | null;
  avgSpeedMps: number | null;
  eventCount: number;
  /** The phone's score for the drive (same formula as the server's); shown until the server's arrives. */
  score?: number;
  /** Phone's motion-sensor maximum; the server's value (which may be a GPS estimate) wins once loaded. */
  maxG: number | null;
  route: {latitude: number; longitude: number}[];
  /** Fixes recorded but not yet uploaded when the drive ended. */
  unsentSamples: Sample[];
  /** Ended by the 3-minute parked rule rather than the End button. */
  autoEnded: boolean;
}

export interface RecordingState {
  status: RecordingStatus;
  startedAt: number | null;
  /** Total paused time already closed off, so the clock excludes it. */
  pausedMs: number;
  pausedAt: number | null;
  stats: LiveStats;
  route: {latitude: number; longitude: number}[];
  vehicle: DriveVehicle | null;
  /** Vehicle an auto-started drive uses (the one picked on Drive). */
  defaultVehicle: DriveVehicle | null;
  position: Sample | null;
  lastAltitudeRef: number | null;
  lastEvent: {kind: DriveEventKind; at: number} | null;
  permission: LocationPermission;
  /** Server trip for the live drive. */
  tripId: string | null;
  /** Recorded fixes waiting to be uploaded, oldest first. Survives app restarts. */
  pending: Sample[];
  syncState: SyncState;
  /** Last time the car moved, for auto-end. */
  lastMovementAt: number | null;
  recentFixes: Sample[];
  /** Last speed reading accepted as real, for rejecting spikes (compared to this, not to a spike). */
  trustedSpeed: {mps: number; at: number} | null;
  /** Highest motion G since the last recorded fix; attached to the next fix as `peakG`. */
  motionPeakG: number | null;
  /** Consecutive fresh Ready fixes at auto-start speed. */
  fastFixes: number;
  /** Background (OS) location updates are delivering fixes, so the foreground watcher stands down. */
  backgroundActive: boolean;
  /** A drive that just ended, waiting for the app to open its summary. */
  justFinished: FinishedDrive | null;
  /** Speed alert (Settings): whether the drive is over the limit and when it last fired. */
  speedAlert: SpeedAlertState;
  setPermission: (permission: LocationPermission) => void;
  setDefaultVehicle: (vehicle: DriveVehicle | null) => void;
  setBackgroundActive: (active: boolean) => void;
  start: (vehicle: DriveVehicle | null, startedAt?: number) => void;
  pause: () => void;
  resume: () => void;
  /** Stops the drive, resets to Ready and returns the finished drive (null if none was live). */
  end: (endedAt?: number, autoEnded?: boolean) => FinishedDrive | null;
  consumeFinished: () => FinishedDrive | null;
  ingest: (sample: Sample) => void;
  /** Peak horizontal acceleration (m/s², gravity removed) over the last motion window. */
  ingestMotion: (accelMps2: number) => void;
  markTripStarted: (tripId: string) => void;
  /** Removes the first `count` pending fixes (they are being uploaded). */
  takePending: (count: number) => Sample[];
  /** Puts fixes back at the front of the queue after a failed upload. */
  returnPending: (samples: Sample[]) => void;
  setSyncState: (syncState: SyncState) => void;
  restore: (snapshot: Partial<RecordingState>) => void;
}

export const elapsedSeconds = (
  state: Pick<RecordingState, 'startedAt' | 'pausedMs' | 'pausedAt'>,
  now: number,
): number => {
  if (state.startedAt == null) {
    return 0;
  }
  const pausedOpen = state.pausedAt != null ? now - state.pausedAt : 0;
  return Math.max(0, (now - state.startedAt - state.pausedMs - pausedOpen) / 1000);
};

export const avgSpeedMps = (distanceM: number, seconds: number): number | null =>
  seconds > 0 && distanceM > 0 ? distanceM / seconds : null;

const SESSION_RESET = {
  status: 'ready' as RecordingStatus,
  startedAt: null,
  pausedMs: 0,
  pausedAt: null,
  route: [],
  vehicle: null,
  tripId: null,
  pending: [],
  syncState: 'idle' as SyncState,
  lastMovementAt: null,
  recentFixes: [],
  fastFixes: 0,
  trustedSpeed: null,
  motionPeakG: null,
  lastEvent: null,
  speedAlert: {over: false, lastAlertAt: null} as SpeedAlertState,
};

/**
 * The live recording session, above the router so the Drive screen, the mini banner, the sync loop
 * and the background location task all read and write the same state. Fixes arrive from
 * `tracking/` (foreground watcher, the OS background task on a dev build, or a simulated feed on
 * web). `tracking/tripSync` uploads `pending` while the drive runs.
 */
export const useRecordingStore = create<RecordingState>((set, get) => ({
  ...SESSION_RESET,
  stats: EMPTY_STATS,
  defaultVehicle: null,
  position: null,
  lastAltitudeRef: null,
  permission: 'unknown',
  backgroundActive: false,
  justFinished: null,
  setPermission: (permission) => set({permission}),
  setDefaultVehicle: (defaultVehicle) => set({defaultVehicle}),
  setBackgroundActive: (backgroundActive) => set({backgroundActive}),
  start: (vehicle, startedAt = Date.now()) => {
    if (get().status !== 'ready') {
      return;
    }
    set({
      ...SESSION_RESET,
      status: 'recording',
      startedAt,
      vehicle,
      syncState: vehicle ? 'syncing' : 'local',
      // The idle clock starts now, whatever time the drive is backdated to.
      lastMovementAt: Math.max(startedAt, Date.now()),
      stats: {...EMPTY_STATS, headingDeg: get().stats.headingDeg, accuracyM: get().stats.accuracyM},
      lastAltitudeRef: null,
    });
  },
  pause: () => {
    if (get().status === 'recording') {
      // Paused shows 0, not the last moving speed frozen on screen.
      set({status: 'paused', pausedAt: Date.now(), stats: {...get().stats, speedMps: 0}});
    }
  },
  resume: () => {
    const {status, pausedAt, pausedMs} = get();
    if (status === 'paused' && pausedAt != null) {
      // Restart the idle clock so a long pause does not read as parked and auto-end at once.
      set({status: 'recording', pausedMs: pausedMs + (Date.now() - pausedAt), pausedAt: null, lastMovementAt: Date.now(), recentFixes: []});
    }
  },
  end: (endedAt = Date.now(), autoEnded = false) => {
    const state = get();
    if (state.status === 'ready' || state.startedAt == null) {
      return null;
    }
    const durationSeconds = Math.round(elapsedSeconds(state, endedAt));
    const finished: FinishedDrive = {
      vehicle: state.vehicle,
      tripId: state.tripId,
      startedAt: state.startedAt,
      endedAt,
      durationSeconds,
      distanceM: state.stats.distanceM,
      topSpeedMps: state.stats.topSpeedMps,
      // Moving time, so stops at lights and in traffic do not drag the average down.
      avgSpeedMps: avgSpeedMps(state.stats.distanceM, state.stats.movingSeconds),
      eventCount: state.stats.eventCount,
      score: liveScore(state.stats),
      maxG: state.stats.maxG,
      route: state.route,
      unsentSamples: state.pending,
      autoEnded,
    };
    set({...SESSION_RESET, stats: {...EMPTY_STATS, headingDeg: state.stats.headingDeg}, justFinished: finished});
    return finished;
  },
  consumeFinished: () => {
    const finished = get().justFinished;
    if (finished) {
      set({justFinished: null});
    }
    return finished;
  },
  ingest: (sample) => {
    const state = get();
    const prevFix = state.position;
    if (!isUsableFix(sample.accuracyM, prevFix != null)) {
      return;
    }
    const speed = Math.max(0, sample.speedMps ?? 0);
    const headingDeg = resolveHeading({
      previousHeading: state.stats.headingDeg,
      previousPoint: prevFix,
      point: sample,
      speedMps: sample.speedMps,
      nativeHeading: sample.headingDeg,
      stepMeters: prevFix ? haversineMeters(prevFix, sample) : 0,
    });
    // Altitude is shown at Ready and while paused too (the map's elevation chip), not only when recording.
    const fix = {
      headingDeg,
      moving: speed >= MOVING_MPS,
      accuracyM: sample.accuracyM,
      altitudeM: sample.altitudeM ?? state.stats.altitudeM,
    };
    const fresh = Date.now() - sample.timestamp <= FRESH_FIX_MS;

    const prefs = usePreferencesStore.getState();
    if (state.status === 'ready') {
      const fast = fresh && prefs.autoStart && shouldAutoStart(sample.speedMps, state.defaultVehicle != null);
      const fastFixes = fast ? state.fastFixes + 1 : 0;
      set({position: sample, stats: {...state.stats, ...fix, speedMps: speed}, fastFixes});
      if (fastFixes >= AUTO_START_FIXES) {
        get().start(state.defaultVehicle, sample.timestamp);
      }
      return;
    }
    if (state.status === 'paused') {
      set({position: sample, stats: {...state.stats, ...fix, speedMps: 0}});
      return;
    }

    const prev = prevFix;
    const stats = {...state.stats, ...fix, speedMps: speed};
    let route = state.route;
    if (prev) {
      const step = haversineMeters(prev, sample);
      const stepSeconds = Math.max(1, (sample.timestamp - prev.timestamp) / 1000);
      const jump = step / stepSeconds > MAX_PLAUSIBLE_MPS;
      if (step >= MIN_STEP_M && !jump) {
        stats.distanceM += step;
        route = [...route, {latitude: sample.latitude, longitude: sample.longitude}];
      }
      const dt = (sample.timestamp - prev.timestamp) / 1000;
      if (dt > 0 && prev.speedMps != null && sample.speedMps != null) {
        const accel = (sample.speedMps - prev.speedMps) / dt;
        let kind: DriveEventKind | null = null;
        if (accel >= RAPID_ACCELERATION_MPS2) {
          kind = 'rapid_acceleration';
        } else if (accel <= HARSH_BRAKE_MPS2) {
          kind = 'harsh_brake';
        } else if (speed > OVERSPEED_MPS && prev.speedMps <= OVERSPEED_MPS) {
          kind = 'overspeed';
        }
        if (kind === 'harsh_brake') {
          stats.brakeCount += 1;
        } else if (kind === 'rapid_acceleration') {
          stats.accelCount += 1;
        } else if (kind === 'overspeed') {
          stats.overspeedIntensity += speed / OVERSPEED_MPS;
        }
        if (kind) {
          stats.eventCount += 1;
          set({lastEvent: {kind, at: sample.timestamp}});
        }
      }
    } else {
      route = [{latitude: sample.latitude, longitude: sample.longitude}];
    }
    const gapS = prev ? (sample.timestamp - prev.timestamp) / 1000 : 0;
    if (fix.moving && gapS > 0 && gapS <= MAX_MOVING_GAP_S) {
      stats.movingSeconds += gapS;
    }
    let trustedSpeed = state.trustedSpeed;
    if (sample.speedMps != null && sample.speedMps <= MAX_PLAUSIBLE_MPS) {
      const sinceTrusted = trustedSpeed ? (sample.timestamp - trustedSpeed.at) / 1000 : 0;
      const plausible =
        !trustedSpeed || sinceTrusted <= 0 || Math.abs(sample.speedMps - trustedSpeed.mps) / sinceTrusted <= MAX_PLAUSIBLE_ACCEL_MPS2;
      if (plausible) {
        stats.topSpeedMps = Math.max(stats.topSpeedMps ?? 0, sample.speedMps);
        trustedSpeed = {mps: sample.speedMps, at: sample.timestamp};
      }
    }
    let lastAltitudeRef = state.lastAltitudeRef;
    if (sample.altitudeM != null) {
      stats.altitudeM = sample.altitudeM;
      if (lastAltitudeRef == null) {
        lastAltitudeRef = sample.altitudeM;
      } else if (Math.abs(sample.altitudeM - lastAltitudeRef) >= ALT_SMOOTH_M) {
        if (sample.altitudeM > lastAltitudeRef) {
          stats.elevationGainM += sample.altitudeM - lastAltitudeRef;
        }
        lastAltitudeRef = sample.altitudeM;
      }
    }
    const lastMovementAt = fix.moving ? sample.timestamp : state.lastMovementAt;
    const recentFixes = [...state.recentFixes, sample].slice(-RECENT_FIXES);
    const recorded = {...sample, peakG: state.motionPeakG};
    const alert = prefs.speedAlert && fresh ? nextSpeedAlert(state.speedAlert, speed * 3.6, prefs.speedAlertKmh, sample.timestamp).state : state.speedAlert;
    set({
      speedAlert: alert,
      stats,
      route,
      pending: [...state.pending, recorded],
      motionPeakG: null,
      trustedSpeed,
      position: sample,
      lastAltitudeRef,
      lastMovementAt,
      recentFixes,
    });
    if (fresh && prefs.autoStop && shouldAutoEnd(lastMovementAt, sample.timestamp, recentFixes, prefs.autoStopMinutes * 60)) {
      get().end(sample.timestamp, true);
    }
  },
  ingestMotion: (accelMps2) => {
    const state = get();
    if (state.status !== 'recording') {
      return;
    }
    const g = toG(accelMps2);
    set({
      motionPeakG: Math.max(state.motionPeakG ?? 0, g),
      stats: {
        ...state.stats,
        liveG: g,
        maxG: Math.max(state.stats.maxG ?? 0, g),
        smoothness: smoothnessFor(accelMps2),
      },
    });
  },
  markTripStarted: (tripId) => set({tripId}),
  takePending: (count) => {
    const taken = get().pending.slice(0, count);
    set({pending: get().pending.slice(taken.length)});
    return taken;
  },
  returnPending: (samples) => set({pending: [...samples, ...get().pending]}),
  setSyncState: (syncState) => set({syncState}),
  restore: (snapshot) => set(snapshot),
}));
