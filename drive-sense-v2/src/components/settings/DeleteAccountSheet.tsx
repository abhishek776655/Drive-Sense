import {useState} from 'react';
import {ActivityIndicator, Pressable, TextInput, View} from 'react-native';
import {getApiErrorMessage} from '../../services/apiClient';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {BottomSheet} from '../drive/BottomSheet';

interface DeleteAccountSheetProps {
  visible: boolean;
  onConfirm: (password: string) => Promise<void>;
  onClose: () => void;
}

/** Password check before the account and every drive are deleted for good. Mounted only while open. */
export function DeleteAccountSheet({visible, onConfirm, onClose}: DeleteAccountSheetProps) {
  const theme = useAppTheme();
  const c = theme.colors;
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(password);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not delete the account.'));
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible={visible} title="Delete account" onClose={onClose}>
      <View style={{gap: 12, marginTop: 8, marginBottom: 8}}>
        <AppText size={14} weight="semibold" tone="secondary">
          This permanently deletes your account, vehicles and every drive. It cannot be undone. Export your drives first if you want to keep them.
        </AppText>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Your password"
          placeholderTextColor={c.textTertiary}
          selectionColor={c.accent}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          accessibilityLabel="Password"
          style={{height: 50, borderRadius: 16, paddingHorizontal: 16, backgroundColor: c.glassRow, color: c.textPrimary, fontFamily: theme.font.semibold, fontSize: 16}}
        />
        {error ? (
          <AppText size={13} weight="bold" color={c.red}>
            {error}
          </AppText>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={!password || busy}
          onPress={() => void confirm()}
          style={{height: 50, borderRadius: 99, alignItems: 'center', justifyContent: 'center', backgroundColor: c.red, opacity: !password || busy ? 0.5 : 1}}>
          {busy ? (
            <ActivityIndicator color={c.onAccent} />
          ) : (
            <AppText size={16} weight="black" tone="onAccent">
              Delete forever
            </AppText>
          )}
        </Pressable>
      </View>
    </BottomSheet>
  );
}
