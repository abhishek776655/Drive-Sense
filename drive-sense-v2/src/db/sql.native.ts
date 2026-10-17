import type {SqlDb, SqlValue} from './sql';

export type {SqlDb, SqlValue} from './sql';

const FILE = 'drivesense.db';

/** The app's SQLite file through expo-sqlite (loaded lazily, so importing this never touches native code). */
export const openNativeDb = (): SqlDb | null => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SQLite = require('expo-sqlite') as typeof import('expo-sqlite');
  const db = SQLite.openDatabaseSync(FILE);
  db.execSync('PRAGMA journal_mode = WAL;');
  // SQLite cannot nest transactions: one started inside another just joins it.
  let depth = 0;
  return {
    exec: (sql) => db.execSync(sql),
    run: (sql, params = []) => {
      db.runSync(sql, params as SqlValue[]);
    },
    all: <T,>(sql: string, params: SqlValue[] = []) => db.getAllSync<T>(sql, params as SqlValue[]),
    get: <T,>(sql: string, params: SqlValue[] = []) => db.getFirstSync<T>(sql, params as SqlValue[]) ?? undefined,
    transaction: (fn) => {
      if (depth > 0) {
        fn();
        return;
      }
      depth += 1;
      try {
        db.withTransactionSync(fn);
      } finally {
        depth -= 1;
      }
    },
  };
};
