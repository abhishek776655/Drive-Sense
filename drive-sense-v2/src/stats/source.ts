import {getDb} from '../db';
import {PROFILE_CACHE_KEY, unreachable, withOfflineCache} from '../db/offlineCache';
import {cacheGet, statsComplete} from '../db/repos';
import type {SqlDb} from '../db/sql';
import type {Profile} from '../services/profileService';
import {usePreferencesStore} from '../stores/preferencesStore';
import {useProfileStore} from '../stores/profileStore';
import {useSyncStore} from '../sync/syncStore';

/**
 * Stats from the phone (spec 2026-10-17, local-first part 2c). Once a sync has filled the local
 * copy and it holds every trip's numbers and route, the phone works the answer out itself, drives
 * waiting to upload included. Before that the server answers; if it cannot be reached, the phone's
 * best answer from what it has. Without a local copy (web, before the first sync) it is the server
 * with its last kept answer.
 */
export async function localFirst<T>(key: string, local: (db: SqlDb) => T, remote: () => Promise<T>): Promise<T> {
  const db = useSyncStore.getState().ready ? getDb() : null;
  if (!db) {
    return withOfflineCache(key, remote);
  }
  // "This phone only": the server no longer has (all) the drives.
  if (usePreferencesStore.getState().driveBackup === 'phone' || statsComplete(db)) {
    return local(db);
  }
  try {
    return await remote();
  } catch (error) {
    if (unreachable(error)) {
      return local(db);
    }
    throw error;
  }
}

/** The signed-in profile, or its last kept copy offline. */
export const currentProfile = (db: SqlDb): Profile | null => useProfileStore.getState().profile ?? cacheGet<Profile>(db, PROFILE_CACHE_KEY);
