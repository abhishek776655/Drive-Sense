import {isAxiosError} from 'axios';
import {getDb} from '.';
import {cacheGet, cachePut} from './repos';

/**
 * No answer from the app server: no response at all (offline), or a gateway saying it is down
 * (502–504 from a proxy or tunnel). Only then is the last kept answer better than an error.
 */
const unreachable = (error: unknown) => isAxiosError(error) && (error.response == null || [502, 503, 504].includes(error.response.status));

/**
 * Fetches and keeps the answer on the phone; when the server cannot be reached, returns the last
 * kept answer instead (Home, stats, achievements offline). Other errors (401, 422) still throw.
 */
export async function withOfflineCache<T>(key: string, fetch: () => Promise<T>): Promise<T> {
  const db = getDb();
  try {
    const value = await fetch();
    if (db) {
      cachePut(db, key, value);
    }
    return value;
  } catch (error) {
    const kept = db && unreachable(error) ? cacheGet<T>(db, key) : null;
    if (kept != null) {
      return kept;
    }
    throw error;
  }
}
