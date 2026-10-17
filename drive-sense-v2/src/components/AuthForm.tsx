import {Link} from 'expo-router';
import {useState} from 'react';
import {KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {getApiErrorMessage} from '../services/apiClient';
import {useAuthStore} from '../stores/authStore';
import {useAppTheme} from '../theme/ThemeProvider';
import {validateLogin, type AuthFieldErrors} from '../utils/authValidation';
import {AppText} from './AppText';
import {RoadLogo} from './brand/RoadLogo';
import {ActionButton} from './ActionButton';

function Field({
  label,
  value,
  onChangeText,
  error,
  secure,
  email,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  secure?: boolean;
  email?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <View style={{gap: 6}}>
      <AppText size={13} weight="bold" tone="secondary">
        {label}
      </AppText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={email ? 'email-address' : 'default'}
        textContentType={email ? 'emailAddress' : secure ? 'password' : 'none'}
        accessibilityLabel={label}
        placeholderTextColor={theme.colors.textTertiary}
        style={{
          height: 52,
          borderRadius: 16,
          paddingHorizontal: 16,
          backgroundColor: theme.colors.card,
          color: theme.colors.textPrimary,
          fontFamily: theme.font.bold,
          fontSize: 16,
          borderWidth: 1.5,
          borderColor: error ? theme.colors.red : 'transparent',
        }}
      />
      {error ? (
        <AppText size={12} weight="semibold" color={theme.colors.red}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

/** Sign in with a username (handle) or an email. New accounts go through onboarding instead. */
export function AuthForm() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const {login, notice} = useAuthStore();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const found = validateLogin({identifier, password});
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length > 0) {
      return;
    }
    setBusy(true);
    try {
      await login(identifier.trim(), password);
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'Could not sign you in.'));
    } finally {
      setBusy(false);
    }
  };

  const banner = formError || notice;

  return (
    <KeyboardAvoidingView style={{flex: 1, backgroundColor: theme.colors.canvas}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: insets.top + 24, gap: 16}} keyboardShouldPersistTaps="handled">
        <View style={{marginBottom: 12}}>
          <View style={{marginBottom: 18}}>
            <RoadLogo variant="tile" size={56} />
          </View>
          <AppText size={30} weight="extrabold" tone="secondary">
            Welcome
          </AppText>
          <AppText size={38} weight="black">
            Back
          </AppText>
        </View>
        {banner ? (
          <View style={{backgroundColor: theme.colors.accentTint, borderRadius: 16, padding: 12}}>
            <AppText size={13} weight="bold" tone="accent">
              {banner}
            </AppText>
          </View>
        ) : null}
        <Field label="Username or email" value={identifier} onChangeText={setIdentifier} error={errors.identifier} email />
        <Field label="Password" value={password} onChangeText={setPassword} error={errors.password} secure />
        <ActionButton label="Sign in" onPress={submit} busy={busy} height={52} size={16} style={{marginTop: 8}} />
        <Link href="/signup" replace asChild>
          <Pressable accessibilityRole="link" style={{alignItems: 'center', padding: 8}}>
            <AppText size={14} weight="bold" tone="secondary">
              New here?{' '}
              <AppText size={14} weight="extrabold" tone="accent">
                Create an account
              </AppText>
            </AppText>
          </Pressable>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
