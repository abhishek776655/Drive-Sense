import {router} from 'expo-router';
import {useEffect, useState} from 'react';
import {View} from 'react-native';
import {AppText} from '../../components/AppText';
import {LineField, PillButton} from '../../components/onboarding/controls';
import {FadeUp, StepEnter} from '../../components/onboarding/motion';
import {OnboardingShell} from '../../components/onboarding/OnboardingShell';
import {getApiErrorMessage} from '../../services/apiClient';
import {profileService} from '../../services/profileService';
import {useAuthStore} from '../../stores/authStore';
import {withAlpha} from '../../theme/color';
import {useAppTheme} from '../../theme/ThemeProvider';
import {emailProblem, passwordProblem} from '../../utils/authValidation';
import {handleProblem, HANDLE_MAX, normalizeHandle} from '../../utils/handle';

/** Pause after typing before asking the server whether the handle is free. */
const CHECK_DELAY_MS = 400;

/** `unknown`: the server could not be asked; sign-up itself still refuses a taken handle. */
type Check = {state: 'idle' | 'checking' | 'ok' | 'bad' | 'unknown'; message: string | null};

/**
 * Onboarding step 1 (spec 2026-10-17, onboarding): pick a @handle (checked live), a password, and
 * optionally an email for recovery. Creating the account signs in, and the root stack moves on to
 * the rest of onboarding by itself.
 */
export default function SignupScreen() {
  const c = useAppTheme().colors;
  const register = useAuthStore((s) => s.register);
  const [text, setText] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [check, setCheck] = useState<Check>({state: 'idle', message: null});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const handle = normalizeHandle(text);

  // Local rules first; the server is asked only once the user pauses on a well-formed handle.
  useEffect(() => {
    if (!handle || handleProblem(handle)) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      profileService
        .checkHandleForSignup(handle)
        .then((result) => {
          if (!cancelled) {
            setCheck(result.available ? {state: 'ok', message: 'Available'} : {state: 'bad', message: result.reason === 'taken' ? 'Taken' : result.reason});
          }
        })
        .catch(() => {
          if (!cancelled) {
            setCheck({state: 'unknown', message: "Can't check now"});
          }
        });
    }, CHECK_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [handle]);

  const problem = handle ? handleProblem(handle) : null;
  const status: Check = !handle ? {state: 'idle', message: null} : problem ? {state: 'bad', message: problem} : check;
  const passwordOk = passwordProblem(password) == null;
  const emailIssue = emailProblem(email);
  const canCreate = (status.state === 'ok' || status.state === 'unknown') && passwordOk && emailIssue == null && !busy;

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      await register({handle, password, email: email.trim() || null});
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not create your account.'));
      setBusy(false);
    }
  };

  return (
    <StepEnter direction={1}>
      <OnboardingShell
        step={1}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))}
        title="Let's meet"
        subtitle="Pick a handle and a password. Add an email if you'd like a way back in."
        footer={<PillButton label="Let me in" onPress={create} disabled={!canCreate} busy={busy} />}>
        <FadeUp index={2}>
          <LineField
            value={text ? `@${handle}` : ''}
            onChangeText={(value) => {
              setText(value.replace(/^@+/, ''));
              setCheck({state: 'checking', message: null});
            }}
            placeholder="@username"
            valid={status.state === 'ok'}
            note={status.state === 'checking' ? '…' : (status.message ?? undefined)}
            textContentType="username"
            maxLength={HANDLE_MAX + 1}
            autoFocus
          />
        </FadeUp>
        <FadeUp index={3}>
          <LineField
            value={password}
            onChangeText={setPassword}
            placeholder="password"
            valid={passwordOk}
            note={password && !passwordOk ? '8+ characters' : undefined}
            secure
            textContentType="newPassword"
          />
        </FadeUp>
        <FadeUp index={4}>
          <LineField
            value={email}
            onChangeText={setEmail}
            placeholder="email (optional)"
            valid={!!email.trim() && emailIssue == null}
            note={emailIssue ? 'Check it' : undefined}
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="done"
            onSubmitEditing={() => canCreate && void create()}
          />
        </FadeUp>
        {error ? (
          <View style={{backgroundColor: withAlpha(c.onAccent, 0.16), borderRadius: 18, padding: 14}}>
            <AppText size={14} weight="bold" color={c.onAccent}>
              {error}
            </AppText>
          </View>
        ) : null}
      </OnboardingShell>
    </StepEnter>
  );
}
