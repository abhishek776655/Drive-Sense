import {Ionicons} from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {useState, type ComponentProps} from 'react';
import {Alert, Pressable, View} from 'react-native';
import {getDb} from '../../db';
import {backupCounts, metaGet} from '../../db/repos';
import {usePreferencesStore, type DriveBackup} from '../../stores/preferencesStore';
import {exportBackup, importBackup} from '../../sync/backupFile';
import {deleteCloudDrives, DRIVE_BACKUP_COPY, setDriveBackup} from '../../sync/driveBackup';
import {LAST_PULL_KEY} from '../../sync/pull';
import {requestSync} from '../../sync/syncEngine';
import {useSyncStore} from '../../sync/syncStore';
import {withAlpha} from '../../theme/color';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {Card} from '../Card';
import {DeleteAccountSheet} from './DeleteAccountSheet';
import {SettingsGroup, SettingsLabel, SettingsRow} from './SettingsRows';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Counts = {total: number; inCloud: number; waiting: number};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "just now", "5 min ago", "3 h ago", "2 days ago". */
export const sinceLabel = (iso: string | null, now = Date.now()): string | null => {
  if (!iso) {
    return null;
  }
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : `${plural(Math.round(hours / 24), 'day')} ago`;
};

/** One line under the choice: what the phone and the server hold right now. */
export const backupStatus = (mode: DriveBackup, counts: Counts, lastSync: string | null, syncing: boolean): {icon: IconName; tone: 'ok' | 'busy' | 'warn'; text: string} => {
  if (mode === 'phone') {
    const cloud = counts.inCloud > 0 ? ` · ${plural(counts.inCloud, 'copy', 'copies')} still in the cloud` : '';
    return {icon: 'phone-portrait', tone: counts.inCloud > 0 ? 'warn' : 'ok', text: `${plural(counts.total, 'drive')} on this phone${cloud}`};
  }
  if (syncing) {
    return {icon: 'sync', tone: 'busy', text: 'Syncing…'};
  }
  const waiting = counts.total - counts.inCloud;
  if (waiting > 0) {
    return {icon: 'cloud-upload', tone: 'busy', text: `${plural(waiting, 'drive')} waiting to upload`};
  }
  const when = sinceLabel(lastSync);
  return {icon: 'checkmark-circle', tone: 'ok', text: `${plural(counts.total, 'drive')} backed up${when ? ` · synced ${when}` : ''}`};
};

/** A choice card: icon tile, title (with an optional badge), description, and a round check. */
function BackupOption({value, icon, selected, recommended, onPress}: {value: DriveBackup; icon: IconName; selected: boolean; recommended?: boolean; onPress: () => void}) {
  const c = useAppTheme().colors;
  const copy = DRIVE_BACKUP_COPY[value];
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{selected}}
      accessibilityLabel={copy.title}
      accessibilityHint={copy.body}
      onPress={onPress}
      style={({pressed}) => ({
        flexDirection: 'row',
        gap: 14,
        padding: 14,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: selected ? c.accent : 'transparent',
        backgroundColor: selected ? c.accentTint : c.glassRow,
        opacity: pressed ? 0.75 : 1,
      })}>
      <View
        style={{width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? c.accent : withAlpha(c.textSecondary, 0.12)}}>
        <Ionicons name={icon} size={21} color={selected ? c.onAccent : c.textSecondary} />
      </View>
      <View style={{flex: 1, gap: 3}}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap'}}>
          <AppText size={16} weight="black">
            {copy.title}
          </AppText>
          {recommended ? (
            <View style={{paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, backgroundColor: withAlpha(c.green, 0.16)}}>
              <AppText size={11} weight="extrabold" color={c.green}>
                Recommended
              </AppText>
            </View>
          ) : null}
        </View>
        <AppText size={13} weight="semibold" tone="secondary">
          {copy.body}
        </AppText>
      </View>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          alignSelf: 'center',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: selected ? 0 : 2,
          borderColor: c.separator,
          backgroundColor: selected ? c.accent : 'transparent',
        }}>
        {selected ? <Ionicons name="checkmark" size={15} color={c.onAccent} /> : null}
      </View>
    </Pressable>
  );
}

/**
 * Settings' "Drive backup" (spec 2026-10-17, local-first part 3): cloud backup or this phone only as
 * two cards with the current state underneath, a backup file to save anywhere and import back, and,
 * on phone only, deleting the cloud's copies.
 */
export function DriveBackupSection() {
  const c = useAppTheme().colors;
  const mode = usePreferencesStore((s) => s.driveBackup);
  // Subscribed so the counts below are read again after every local change (a sync, an upload, a
  // saved drive); two small queries per render.
  useSyncStore((s) => s.version);
  const syncing = useSyncStore((s) => s.syncing);
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [deleting, setDeleting] = useState(false);
  const db = getDb();
  const state: {counts: Counts; lastSync: string | null} | null = db ? {counts: backupCounts(db), lastSync: metaGet(db, LAST_PULL_KEY)} : null;

  const choose = (next: DriveBackup) => {
    if (next === mode) {
      return;
    }
    void Haptics.selectionAsync().catch(() => undefined);
    if (next === 'phone') {
      Alert.alert(DRIVE_BACKUP_COPY.phone.title, `${DRIVE_BACKUP_COPY.phone.body}\n\nDrives already in the cloud stay there until you delete them.`, [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Keep on this phone', style: 'destructive', onPress: () => void setDriveBackup('phone')},
      ]);
      return;
    }
    const waiting = state ? state.counts.total - state.counts.inCloud : 0;
    Alert.alert(DRIVE_BACKUP_COPY.cloud.title, waiting > 0 ? `${plural(waiting, 'drive')} on this phone will upload to your account.` : DRIVE_BACKUP_COPY.cloud.body, [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Turn on', onPress: () => void setDriveBackup('cloud').then(() => void requestSync())},
    ]);
  };

  const onExport = async () => {
    setBusy('export');
    try {
      await exportBackup();
    } catch (error) {
      Alert.alert('Backup failed', error instanceof Error ? error.message : 'Could not write the backup.');
    } finally {
      setBusy(null);
    }
  };

  const onImport = async () => {
    setBusy('import');
    try {
      const result = await importBackup();
      if (result) {
        Alert.alert(
          'Import finished',
          result.added > 0
            ? `${plural(result.added, 'drive')} added${result.skipped ? `, ${plural(result.skipped, 'drive')} already here` : ''}.`
            : 'Every drive in that backup is already on this phone.',
        );
      }
    } catch (error) {
      Alert.alert('Import failed', error instanceof Error ? error.message : 'Could not read that file.');
    } finally {
      setBusy(null);
    }
  };

  const onDeleteCloud = async (password: string) => {
    await deleteCloudDrives(password);
    setDeleting(false);
    Alert.alert('Cloud data deleted', 'Your drives are now only on this phone.');
  };

  const status = state ? backupStatus(mode, state.counts, state.lastSync, syncing) : null;
  const toneColor = status?.tone === 'warn' ? c.amber : status?.tone === 'busy' ? c.blue : c.green;
  const inCloud = state?.counts.inCloud ?? 0;

  return (
    <>
      <SettingsLabel>DRIVE BACKUP</SettingsLabel>
      <View style={{gap: 12}}>
        <Card style={{padding: 12, gap: 10}}>
          <View accessibilityRole="radiogroup" style={{gap: 10}}>
            <BackupOption value="cloud" icon="cloud-done" recommended selected={mode === 'cloud'} onPress={() => choose('cloud')} />
            <BackupOption value="phone" icon="phone-portrait" selected={mode === 'phone'} onPress={() => choose('phone')} />
          </View>
          {status ? (
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6, paddingTop: 2, paddingBottom: 4}}>
              <Ionicons name={status.icon} size={16} color={toneColor} />
              <AppText size={13} weight="bold" tone="secondary" style={{flex: 1}}>
                {status.text}
              </AppText>
            </View>
          ) : null}
        </Card>

        <SettingsGroup>
          <SettingsRow
            icon="save"
            iconColor={c.blue}
            title={busy === 'export' ? 'Backing up…' : 'Back up to file'}
            subtitle="Save every drive to Files or iCloud Drive"
            onPress={busy ? undefined : () => void onExport()}
          />
          <SettingsRow
            icon="folder-open"
            iconColor={c.green}
            title={busy === 'import' ? 'Importing…' : 'Import from file'}
            subtitle="Add drives from a DriveSense backup"
            onPress={busy ? undefined : () => void onImport()}
          />
        </SettingsGroup>

        {mode === 'phone' && inCloud > 0 ? (
          <SettingsGroup>
            <SettingsRow
              icon="cloud-offline"
              iconColor={c.red}
              title="Delete cloud data"
              subtitle={`Remove ${plural(inCloud, 'drive')} from the server; this phone keeps them`}
              destructive
              onPress={() => setDeleting(true)}
            />
          </SettingsGroup>
        ) : null}
      </View>

      {deleting ? (
        <DeleteAccountSheet
          visible
          title="Delete cloud data"
          message="This permanently deletes every drive from your DriveSense account. This phone keeps its copies, and your account and vehicles stay. Back up to a file first if you want a spare copy."
          failure="Could not delete your cloud data."
          onConfirm={onDeleteCloud}
          onClose={() => setDeleting(false)}
        />
      ) : null}
    </>
  );
}
