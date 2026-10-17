import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {useEffect, useState} from 'react';
import {ActionSheetIOS, ActivityIndicator, Alert, Platform, Pressable, ScrollView, TextInput, View} from 'react-native';
import {AppText} from '../../components/AppText';
import {GlassButton} from '../../components/GlassButton';
import {Avatar} from '../../components/profile/Avatar';
import {SheetHeader} from '../../components/profile/SheetHeader';
import {getApiErrorMessage} from '../../services/apiClient';
import {profileService} from '../../services/profileService';
import {useProfileStore} from '../../stores/profileStore';
import {useAppTheme} from '../../theme/ThemeProvider';
import {handleProblem, HANDLE_MAX, normalizeHandle} from '../../utils/handle';
import {pickVehiclePhoto, type PhotoSource} from '../../utils/vehiclePhoto';

/** Pause after typing before asking the server whether the handle is free. */
const CHECK_DELAY_MS = 400;

type Check = {state: 'idle' | 'checking' | 'ok' | 'bad'; message: string | null};

/** Edit Profile (Rovy): photo with a camera badge, and the @handle with a live availability check. */
export default function EditProfileScreen() {
  const theme = useAppTheme();
  const c = theme.colors;
  const profile = useProfileStore((s) => s.profile);
  const saveHandle = useProfileStore((s) => s.saveHandle);
  const setAvatar = useProfileStore((s) => s.setAvatar);
  const [text, setText] = useState(profile?.handle ?? '');
  const [check, setCheck] = useState<Check>({state: 'idle', message: null});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const handle = normalizeHandle(text);
  const unchanged = handle === (profile?.handle ?? '');

  // Local rules first; the server is asked only once the user pauses on a well-formed handle.
  useEffect(() => {
    if (unchanged) {
      return;
    }
    const problem = handleProblem(handle);
    if (problem) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      profileService
        .checkHandle(handle)
        .then((result) => {
          if (!cancelled) {
            setCheck(result.available ? {state: 'ok', message: null} : {state: 'bad', message: result.reason === 'taken' ? 'That handle is taken' : result.reason});
          }
        })
        .catch(() => {
          if (!cancelled) {
            setCheck({state: 'idle', message: null});
          }
        });
    }, CHECK_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [handle, unchanged]);

  const problem = handle ? handleProblem(handle) : null;
  const status: Check = unchanged ? {state: profile?.handle ? 'ok' : 'idle', message: null} : problem ? {state: 'bad', message: problem} : check;
  const canSave = !saving && !unchanged && status.state === 'ok';

  const onChange = (value: string) => {
    setText(value);
    setCheck({state: 'checking', message: null});
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveHandle(handle);
      router.back();
    } catch (error) {
      setCheck({state: 'bad', message: error instanceof Error ? error.message : 'Could not save your handle.'});
      setSaving(false);
    }
  };

  const changePhoto = async (source: PhotoSource | 'remove') => {
    try {
      const data = source === 'remove' ? null : await pickVehiclePhoto(source, [1, 1]);
      if (source !== 'remove' && data == null) {
        return;
      }
      setUploading(true);
      await setAvatar(data);
    } catch (error) {
      Alert.alert('Photo', getApiErrorMessage(error, error instanceof Error ? error.message : 'Could not save the photo.'));
    } finally {
      setUploading(false);
    }
  };

  const onPhoto = () => {
    const sources: {label: string; value: PhotoSource | 'remove'}[] = [
      {label: 'Take Photo', value: 'camera'},
      {label: 'Choose Photo', value: 'library'},
      ...(profile?.avatar_url ? [{label: 'Remove Photo', value: 'remove' as const}] : []),
    ];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {options: [...sources.map((s) => s.label), 'Cancel'], cancelButtonIndex: sources.length, destructiveButtonIndex: profile?.avatar_url ? 2 : undefined, tintColor: c.accent},
        (index) => {
          if (index < sources.length) {
            void changePhoto(sources[index].value);
          }
        },
      );
    } else {
      Alert.alert('Profile photo', undefined, [
        ...sources.map((s) => ({text: s.label, style: s.value === 'remove' ? ('destructive' as const) : undefined, onPress: () => void changePhoto(s.value)})),
        {text: 'Cancel', style: 'cancel' as const},
      ]);
    }
  };

  return (
    <View style={{flex: 1, backgroundColor: c.canvas}}>
      <SheetHeader
        title="Edit Profile"
        left={
          <GlassButton accessibilityLabel="Cancel" onPress={() => router.back()} style={{height: 44, paddingHorizontal: 18}}>
            <AppText size={17} weight="bold">
              Cancel
            </AppText>
          </GlassButton>
        }
        right={
          <GlassButton accessibilityLabel="Save" onPress={() => void save()} disabled={!canSave} style={{height: 44, paddingHorizontal: 18}}>
            {saving ? (
              <ActivityIndicator color={c.accent} />
            ) : (
              <AppText size={17} weight="extrabold" tone={canSave ? 'accent' : 'primary'}>
                Save
              </AppText>
            )}
          </GlassButton>
        }
      />
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={{paddingHorizontal: theme.space.screen, paddingBottom: 40}}>
        <Pressable accessibilityRole="button" accessibilityLabel="Change profile photo" onPress={onPhoto} disabled={uploading} style={{alignSelf: 'center', marginTop: 36}}>
          <Avatar profile={profile} size={104} />
          <View style={{position: 'absolute', right: -2, bottom: -2, width: 34, height: 34, borderRadius: 17, backgroundColor: c.accent, borderWidth: 3, borderColor: c.canvas, alignItems: 'center', justifyContent: 'center'}}>
            {uploading ? <ActivityIndicator size="small" color={c.onAccent} /> : <Ionicons name="camera" size={15} color={c.onAccent} />}
          </View>
        </Pressable>

        <AppText size={16} weight="bold" tone="secondary" style={{marginLeft: 16, marginTop: 40, marginBottom: 10}}>
          Handle
        </AppText>
        <View style={{flexDirection: 'row', alignItems: 'center', height: 54, borderRadius: 99, paddingHorizontal: 18, backgroundColor: c.card, gap: 2}}>
          <AppText size={17} weight="bold" tone="accent">
            @
          </AppText>
          <TextInput
            value={text.replace(/^@+/, '')}
            onChangeText={onChange}
            placeholder="yourname"
            placeholderTextColor={c.textTertiary}
            selectionColor={c.accent}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            maxLength={HANDLE_MAX + 1}
            returnKeyType="done"
            onSubmitEditing={() => canSave && void save()}
            accessibilityLabel="Handle"
            style={{flex: 1, height: '100%', color: c.textPrimary, fontFamily: theme.font.semibold, fontSize: 17}}
          />
          {status.state === 'checking' ? (
            <ActivityIndicator size="small" color={c.textTertiary} />
          ) : status.state === 'ok' ? (
            <Ionicons name="checkmark-circle" size={24} color={c.green} />
          ) : status.state === 'bad' ? (
            <Ionicons name="close-circle" size={24} color={c.red} />
          ) : null}
        </View>
        <AppText size={13} weight="semibold" color={status.state === 'bad' ? c.red : c.textTertiary} style={{marginLeft: 18, marginTop: 8}}>
          {status.message ?? '3–20 letters, numbers and _'}
        </AppText>
      </ScrollView>
    </View>
  );
}
