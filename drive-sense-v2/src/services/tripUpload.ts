import {isAxiosError} from 'axios';
import type {FinishedDrive, Sample} from '../stores/recordingStore';
import type {TripMetrics} from '../utils/tripMetrics';
import {tripUploadApi, type LocationPointPayload, type TripFinishPayload} from './tripService';

/** Points per request; keeps each upload well under typical body limits on a long drive. */
export const UPLOAD_BATCH = 200;

/** Where an interrupted finish got to, so a retry continues instead of starting a second trip. */
export interface UploadProgress {
  tripId: string | null;
  uploadedPoints: number;
  ended: boolean;
}

export const NO_PROGRESS: UploadProgress = {tripId: null, uploadedPoints: 0, ended: false};

/** Starting point for finishing a drive: the live sync may already have a server trip. */
export const progressFor = (drive: FinishedDrive): UploadProgress => ({...NO_PROGRESS, tripId: drive.tripId});

const clampHeading = (deg: number | null) => (deg == null || deg < 0 ? null : deg % 360);

export const toPointPayload = (sample: Sample): LocationPointPayload => ({
  recorded_at: new Date(sample.timestamp).toISOString(),
  latitude: sample.latitude,
  longitude: sample.longitude,
  speed_mps: sample.speedMps != null && sample.speedMps >= 0 ? sample.speedMps : null,
  heading_deg: clampHeading(sample.headingDeg),
  accuracy_m: sample.accuracyM != null && sample.accuracyM >= 0 ? sample.accuracyM : null,
  altitude_m: sample.altitudeM,
  // Server accepts 0–5 g; anything outside that is a sensor glitch.
  peak_g: sample.peakG != null && sample.peakG >= 0 && sample.peakG <= 5 ? Math.round(sample.peakG * 1000) / 1000 : null,
});

/** The server closes a trip with no points for 15 minutes; ending it again then finds nothing. */
const alreadyClosed = (error: unknown) =>
  isAxiosError(error) && error.response?.status === 404 && error.response.data?.detail === 'No active trip for vehicle';

/** An older server without `POST /trips/{id}/finish`: end the trip the old way instead. */
const noFinishRoute = (error: unknown) => isAxiosError(error) && (error.response?.status === 405 || (error.response?.status === 404 && error.response.data?.detail === 'Not Found'));

export const finishPayload = (drive: FinishedDrive, metrics: TripMetrics): TripFinishPayload => ({
  end_time: new Date(drive.endedAt).toISOString(),
  distance_meters: Math.round(drive.distanceM),
  duration_seconds: drive.durationSeconds,
  idle_time_seconds: metrics.idleSeconds,
  driving_score: metrics.score,
  max_g_force: metrics.maxG != null ? Math.min(5, Math.round(metrics.maxG * 1000) / 1000) : null,
  max_g_source: metrics.maxGSource,
  left_turns: metrics.leftTurns,
  right_turns: metrics.rightTurns,
  events: metrics.events,
});

/**
 * Finishes a drive on the server: start the trip if the live sync never did (backdated), send the
 * points it had not sent yet in batches, then end it. With the phone's numbers (`metrics`, part 2b)
 * it ends through `/finish`, which stores them as they are and works even when the server already
 * closed the trip as abandoned; otherwise through `/end`. `onProgress` is called after every step so
 * a failure can resume from the last good one.
 */
export async function uploadDrive(
  drive: FinishedDrive,
  samples: Sample[],
  progress: UploadProgress,
  onProgress: (next: UploadProgress) => void,
  metrics?: TripMetrics,
): Promise<UploadProgress> {
  if (!drive.vehicle) {
    throw new Error('Choose a vehicle before saving this drive.');
  }
  let current = {...progress};
  if (!current.tripId) {
    const trip = await tripUploadApi.start(drive.vehicle.id, new Date(drive.startedAt).toISOString());
    current = {...current, tripId: trip.id};
    onProgress(current);
  }
  const tripId = current.tripId as string;
  while (current.uploadedPoints < samples.length) {
    const batch = samples.slice(current.uploadedPoints, current.uploadedPoints + UPLOAD_BATCH);
    await tripUploadApi.locations(tripId, batch.map(toPointPayload));
    current = {...current, uploadedPoints: current.uploadedPoints + batch.length};
    onProgress(current);
  }
  if (!current.ended && metrics) {
    try {
      await tripUploadApi.finish(tripId, finishPayload(drive, metrics));
      current = {...current, ended: true};
      onProgress(current);
      return current;
    } catch (error) {
      if (!noFinishRoute(error)) {
        throw error;
      }
    }
  }
  if (!current.ended) {
    try {
      await tripUploadApi.end({
        vehicle_id: drive.vehicle.id,
        end_time: new Date(drive.endedAt).toISOString(),
        distance_meters: Math.round(drive.distanceM),
        duration_seconds: drive.durationSeconds,
      });
    } catch (error) {
      if (!alreadyClosed(error)) {
        throw error;
      }
    }
    current = {...current, ended: true};
    onProgress(current);
  }
  return current;
}
