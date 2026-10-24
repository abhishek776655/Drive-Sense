import {getDb} from '../db';
import {appendObdSamples, clearObdSamples, obdSamples, putTripObd} from '../db/obdRepos';
import type {SqlDb} from '../db/sql';
import type {PidKey} from '../obd/pids';
import {downsample, summarize, type ObdRow, type ObdSampleRow, type ObdStats} from '../obd/series';
import {useObdStore} from '../stores/obdStore';
import {useRecordingStore, type FinishedDrive} from '../stores/recordingStore';

/** The PIDs a drive keeps, by their row name. */
const ROW_KEYS: Partial<Record<PidKey, keyof ObdRow>> = {
  speed: 'speed',
  rpm: 'rpm',
  throttle: 'throttle',
  load: 'load',
  coolant: 'coolant',
  maf: 'maf',
  fuelRate: 'fuelRate',
  fuelLevel: 'fuelLevel',
  voltage: 'voltage',
  intakeTemp: 'intakeTemp',
  map: 'map',
};

/** Rows are written in small batches rather than one transaction per second. */
const BATCH = 5;

/**
 * Keeps one row per second of OBD data while a drive records (spec 2026-10-25, telemetry,
 * section 4). Driven by values arriving, not a timer: JS timers pause in the background on iOS,
 * Bluetooth callbacks do not. A row holds the latest value of each PID read in that second.
 */
export function startObdRecorder(): () => void {
  const db = getDb();
  if (!db) {
    return () => {};
  }
  let drive: number | null = null;
  let second: number | null = null;
  let row: ObdRow = {};
  let queue: ObdSampleRow[] = [];

  const flush = () => {
    if (drive != null && queue.length > 0) {
      appendObdSamples(db, drive, queue);
    }
    queue = [];
  };

  const closeSecond = () => {
    if (second != null && Object.keys(row).length > 0) {
      queue.push({ts: second * 1000, row});
    }
    second = null;
    row = {};
  };

  const stopObd = useObdStore.subscribe((next, prev) => {
    const rec = useRecordingStore.getState();
    if (rec.status !== 'recording' || rec.startedAt == null || next.values === prev.values) {
      return;
    }
    if (drive !== rec.startedAt) {
      closeSecond();
      flush();
      drive = rec.startedAt;
    }
    for (const key of Object.keys(next.values) as PidKey[]) {
      const value = next.values[key];
      const name = ROW_KEYS[key];
      if (!value || !name || value === prev.values[key]) {
        continue;
      }
      const at = Math.floor(value.at / 1000);
      if (second != null && at > second) {
        closeSecond();
        if (queue.length >= BATCH) {
          flush();
        }
      }
      second ??= at;
      row[name] = value.v;
      if (next.derived.fuelFlow != null) {
        row.fuelFlow = next.derived.fuelFlow;
      }
    }
  });

  // Paused or ended: what is held goes to the database now, so the drive's end sees all of it.
  const stopRec = useRecordingStore.subscribe((next, prev) => {
    if (prev.status === 'recording' && next.status !== 'recording') {
      closeSecond();
      flush();
      if (next.status === 'ready') {
        drive = null;
      }
    }
  });

  return () => {
    closeSecond();
    flush();
    stopObd();
    stopRec();
  };
}

/** At the drive's end: its seconds become a summary and chart series, and the seconds go. */
export const finalizeObd = (db: SqlDb, drive: Pick<FinishedDrive, 'startedAt' | 'durationSeconds'>): ObdStats | null => {
  const rows = obdSamples(db, drive.startedAt);
  clearObdSamples(db, drive.startedAt);
  if (rows.length === 0) {
    return null;
  }
  const stats = summarize(rows, drive.durationSeconds);
  putTripObd(db, drive.startedAt, {stats, series: downsample(rows, drive.startedAt)});
  return stats;
};
