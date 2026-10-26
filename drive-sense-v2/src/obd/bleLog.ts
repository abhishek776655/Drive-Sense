import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * A short log of what the adapter link did, kept on the phone (Settings shows it). A drive that
 * starts while the app is closed leaves no screen to look at, so this is how to see whether iOS woke
 * the app for the adapter and how far it got.
 */
const KEY = 'ble_launch_log_v1';
const MAX_ENTRIES = 40;

export interface BleLogEntry {
  at: string;
  event: string;
}

export const readBleLog = async (): Promise<BleLogEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as BleLogEntry[]) : [];
  } catch {
    return [];
  }
};

/** One write at a time, so events logged together are not lost to each other's read-modify-write. */
let queue: Promise<void> = Promise.resolve();

export const logBle = (event: string): Promise<void> => {
  console.log(`[ble] ${event}`);
  queue = queue.then(async () => {
    try {
      const log = await readBleLog();
      log.push({at: new Date().toISOString(), event});
      await AsyncStorage.setItem(KEY, JSON.stringify(log.slice(-MAX_ENTRIES)));
    } catch {
      // Logging must never get in the way of the link itself.
    }
  });
  return queue;
};

export const clearBleLog = async (): Promise<void> => {
  await queue;
  await AsyncStorage.removeItem(KEY).catch(() => undefined);
};
