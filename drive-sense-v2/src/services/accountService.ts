import {File, Paths} from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {apiClient} from './apiClient';
import {timeZone} from './homeService';

export const accountService = {
  /** All ended drives as CSV, saved to the cache and handed to the share sheet. */
  exportDrives: async (): Promise<void> => {
    const response = await apiClient.get<string>('/api/v1/trips/export.csv', {params: {tz: timeZone()}, responseType: 'text'});
    const file = new File(Paths.cache, 'drivesense-drives.csv');
    file.create({overwrite: true});
    file.write(response.data);
    await Sharing.shareAsync(file.uri, {mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: 'Export drives'});
  },
  /** Permanently deletes the account and all its data; the server checks the password (403 if wrong). */
  deleteAccount: async (password: string): Promise<void> => {
    await apiClient.delete('/api/v1/auth/me', {data: {password}});
  },
};
