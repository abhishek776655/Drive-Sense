export type SqlValue = string | number | null;

/**
 * The few synchronous SQLite calls the local store needs. The app backs it with expo-sqlite
 * (`sql.native.ts`); tests back it with Node's built-in `node:sqlite`.
 */
export interface SqlDb {
  exec: (sql: string) => void;
  run: (sql: string, params?: SqlValue[]) => void;
  all: <T>(sql: string, params?: SqlValue[]) => T[];
  get: <T>(sql: string, params?: SqlValue[]) => T | undefined;
  /** Runs `fn` in one transaction: all of it lands, or none. Inside another transaction it joins that one. */
  transaction: (fn: () => void) => void;
}

/** Web has no local store: the app falls back to the API there. */
export const openNativeDb = (): SqlDb | null => null;
