import {migrate, TABLES} from './schema';
import {openNativeDb, type SqlDb} from './sql';

let db: SqlDb | null | undefined;

/**
 * The local database, opened and migrated on first use. Null where there is none (web) or it could
 * not be opened; callers then fall back to the API.
 */
export const getDb = (): SqlDb | null => {
  if (db === undefined) {
    try {
      db = openNativeDb();
      if (db) {
        migrate(db);
      }
    } catch (error) {
      console.warn('Local database unavailable', error);
      db = null;
    }
  }
  return db;
};

/** Everything local belongs to the signed-in account: signing out (or deleting it) empties it. */
export const wipeDb = () => {
  const local = getDb();
  if (!local) {
    return;
  }
  local.transaction(() => {
    for (const table of TABLES) {
      local.run(`DELETE FROM ${table}`);
    }
  });
};

/** Tests: use an in-memory database (or none). */
export const setDbForTests = (next: SqlDb | null) => {
  db = next;
  if (next) {
    migrate(next);
  }
};
