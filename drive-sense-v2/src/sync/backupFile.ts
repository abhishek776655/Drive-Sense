import * as DocumentPicker from 'expo-document-picker';
import {File, Paths} from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {getDb} from '../db';
import {backupSnapshot, parseBackup, restoreBackup} from '../db/repos';
import {isPhoneOnly, setDriveBackup} from './driveBackup';
import {requestSync} from './syncEngine';
import {useSyncStore} from './syncStore';

/** `drivesense-backup-2026-10-17.json` */
export const backupFileName = (now = new Date()) => `drivesense-backup-${now.toISOString().slice(0, 10)}.json`;

/**
 * Writes every drive on the phone, with its route, to one file and opens the share sheet (Save to
 * Files, iCloud Drive, AirDrop). Returns how many drives went in.
 */
export async function exportBackup(): Promise<number> {
  const db = getDb();
  if (!db) {
    throw new Error('Backups need the app on a phone.');
  }
  const backup = backupSnapshot(db);
  const file = new File(Paths.cache, backupFileName());
  file.create({overwrite: true});
  file.write(JSON.stringify(backup));
  await Sharing.shareAsync(file.uri, {mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Back up drives'});
  return backup.trips.length;
}

/**
 * Picks a backup file and adds the drives this phone does not have. With cloud backup on they then
 * upload. Null when the picker was cancelled.
 */
export async function importBackup(): Promise<{added: number; skipped: number} | null> {
  const db = getDb();
  if (!db) {
    throw new Error('Backups need the app on a phone.');
  }
  const picked = await DocumentPicker.getDocumentAsync({type: ['application/json', 'public.json', '*/*'], copyToCacheDirectory: true});
  if (picked.canceled || !picked.assets[0]) {
    return null;
  }
  const result = restoreBackup(db, parseBackup(await new File(picked.assets[0].uri).text()));
  if (result.added > 0) {
    useSyncStore.setState((s) => ({version: s.version + 1}));
    if (!isPhoneOnly()) {
      await setDriveBackup('cloud', db);
      void requestSync();
    }
  }
  return result;
}
