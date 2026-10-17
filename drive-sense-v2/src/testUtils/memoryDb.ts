import type {SqlDb, SqlValue} from '../db/sql';

/** An in-memory SQLite (Node's built-in `node:sqlite`) behind the app's `SqlDb` interface. */
export function memoryDb(): SqlDb {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {DatabaseSync} = require('node:sqlite') as {DatabaseSync: new (path: string) => any};
  const db = new DatabaseSync(':memory:');
  let depth = 0;
  return {
    exec: (sql) => db.exec(sql),
    run: (sql, params: SqlValue[] = []) => {
      db.prepare(sql).run(...params);
    },
    all: <T,>(sql: string, params: SqlValue[] = []) => db.prepare(sql).all(...params) as T[],
    get: <T,>(sql: string, params: SqlValue[] = []) => db.prepare(sql).get(...params) as T | undefined,
    // Same rule as the app: a transaction inside another joins it.
    transaction: (fn) => {
      if (depth > 0) {
        fn();
        return;
      }
      depth += 1;
      db.exec('BEGIN');
      try {
        fn();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      } finally {
        depth -= 1;
      }
    },
  };
}
