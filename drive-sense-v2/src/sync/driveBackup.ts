import * as Location from 'expo-location';
import {getDb} from '../db';
import {localOnlyTrips, markAllLocalOnly, queueForUpload, setTripAddresses, tripsWithoutRoutes} from '../db/repos';
import type {SqlDb} from '../db/sql';
import {apiClient} from '../services/apiClient';
import {usePreferencesStore, type DriveBackup} from '../stores/preferencesStore';
import {backfillRoutes} from './backfill';
import {useSyncStore} from './syncStore';

/**
 * "Drive backup" (spec 2026-10-17, local-first part 3): drives sync to the account (the default),
 * or never leave this phone. The account, profile and vehicles stay on the server either way.
 */
export const isPhoneOnly = () => usePreferencesStore.getState().driveBackup === 'phone';

export const DRIVE_BACKUP_COPY: Record<DriveBackup, {title: string; body: string}> = {
  cloud: {title: 'Cloud backup', body: 'Drives sync to your DriveSense account. Get them back on a new phone, and see them on more than one device.'},
  phone: {title: 'This phone only', body: "Drives never leave this phone. If you lose it or delete the app, they're gone for good."},
};

const bump = () => useSyncStore.setState((s) => ({version: s.version + 1}));

/**
 * Switches where drives are kept. Back to the cloud, every drive the server does not have is queued
 * to upload with all its points; the caller then runs a sync. Returns how many were queued.
 */
export async function setDriveBackup(mode: DriveBackup, db: SqlDb | null = getDb()): Promise<number> {
  await usePreferencesStore.getState().set({driveBackup: mode});
  if (mode !== 'cloud' || !db) {
    return 0;
  }
  let queued = 0;
  for (const id of localOnlyTrips(db)) {
    if (queueForUpload(db, id)) {
      queued += 1;
    }
  }
  if (queued > 0) {
    bump();
  }
  return queued;
}

export class CloudDeleteBlocked extends Error {}

/**
 * "Delete cloud data": first every route still on the server comes down (on any network, so the
 * phone's copies are complete), then the server deletes every drive for good and the phone marks
 * its copies as the only ones. Throws `CloudDeleteBlocked` when routes could not all be fetched, and
 * the API error (403 for a wrong password) otherwise.
 */
export async function deleteCloudDrives(password: string, db: SqlDb | null = getDb(), post = (body: {password: string}) => apiClient.post('/api/v1/sync/delete-drives', body)) {
  if (!db) {
    throw new CloudDeleteBlocked('Your drives are not on this phone yet.');
  }
  await backfillRoutes(db, () => true);
  const missing = tripsWithoutRoutes(db);
  if (missing > 0) {
    throw new CloudDeleteBlocked(`${missing} ${missing === 1 ? 'drive is' : 'drives are'} still downloading to this phone. Try again with a connection.`);
  }
  await post({password});
  markAllLocalOnly(db);
  bump();
}

/** "Sector 29, Gurugram": the street or place, then the city, as the server's addresses read. */
export const addressFrom = (place: Location.LocationGeocodedAddress | undefined): string | null => {
  if (!place) {
    return null;
  }
  const local = place.street ?? place.name ?? place.district;
  const city = place.city ?? place.subregion ?? place.region;
  const parts = [local, city].filter((p, i, all): p is string => !!p && all.indexOf(p) === i);
  return parts.length ? parts.join(', ') : null;
};

/** A phone-only drive's start and end addresses, from the phone's own place lookup. Best effort. */
export async function lookUpAddresses(db: SqlDb, id: string, start: {latitude: number; longitude: number} | undefined, end: {latitude: number; longitude: number} | undefined) {
  try {
    const [from, to] = await Promise.all([start ? Location.reverseGeocodeAsync(start) : [], end ? Location.reverseGeocodeAsync(end) : []]);
    const startAddress = addressFrom(from[0]);
    const endAddress = addressFrom(to[0]);
    if (startAddress || endAddress) {
      setTripAddresses(db, id, startAddress, endAddress);
      bump();
    }
  } catch {
    // Offline or rate-limited: the drive keeps its place-less title.
  }
}
