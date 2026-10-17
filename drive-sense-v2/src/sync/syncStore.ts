import {create} from 'zustand';

interface SyncState {
  /** A first pull has finished: the Logbook can read the local copy. */
  ready: boolean;
  syncing: boolean;
  /** Bumped whenever local data changed, so screens reading it reload. */
  version: number;
  lastError: string | null;
}

/** Status of the local copy (spec 2026-10-17, local-first part 1). */
export const useSyncStore = create<SyncState>(() => ({ready: false, syncing: false, version: 0, lastError: null}));
