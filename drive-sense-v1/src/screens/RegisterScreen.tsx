import React, {useState} from 'react';
import {KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {authService, getApiErrorMessage} from '../services/apiClient';
import {useAppTheme} from '../theme/appTheme';
import {AuthTextField} from '../components/AuthTextField';
import {AuthBackdrop, AuthErrorBanner, AuthPrimaryButton, BrandMark, Wordmark} from '../components/AuthChrome';

interface RegisterScreenProps {
  onRegisterSuccess: () => void;
  onGoToLogin: () => void;
}

/** Mirrors the backend's `RegisterRequest` minimum, so the server never rejects on length alone. */
export const MIN_PASSWORD_LENGTH = 8;

export type RegisterFieldErrors = {
  email?: string;
  password?: string;
  confirmPassword?: string;
};

/**
 * Validates the sign-up form. Pure so the rules can be tested without rendering, and so the same
 * rules can be reused if sign-up ever moves (web, deep link, admin invite).
 */
export const validateRegistration = ({
  email,
  password,
  confirmPassword,
}: {
  email: string;
  password: string;
  confirmPassword: string;
}): RegisterFieldErrors => {
  const errors: RegisterFieldErrors = {};
  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    errors.email = 'Enter your email address.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errors.email = 'That does not look like an email address.';
  }

  if (!password) {
    errors.password = 'Choose a password.';
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  // Only complain about the confirmation once there is a password worth matching.
  if (password && confirmPassword !== password) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
};

export const RegisterScreen: React.FC<RegisterScreenProps> = ({onRegisterSuccess, onGoToLogin}) => {
  const theme = useAppTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const errors = validateRegistration({email, password, confirmPassword});
    setFieldErrors(errors);
    setFormError('');
    if (Object.keys(errors).length > 0) {
      return;
    }

    setLoading(true);
    try {
      await authService.register(email.trim(), password);
      // Signing in straight away avoids making someone re-type credentials they just chose.
      await authService.login(email.trim(), password);
      onRegisterSuccess();
    } catch (registerError) {
      setFormError(getApiErrorMessage(registerError, 'Could not create your account. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: theme.screen}}>
      <AuthBackdrop />

      <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 32}}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={{alignItems: 'center', marginBottom: 32}}>
            <BrandMark size={76} />
            <View style={{marginTop: 16}}>
              <Wordmark fontSize={30} />
            </View>
            <Text
              style={{
                color: theme.textSubtle,
                ...theme.typography.body,
                marginTop: 8,
                textAlign: 'center',
              }}>
              Create an account to start tracking your drives.
            </Text>
          </View>

          {formError ? <AuthErrorBanner message={formError} /> : null}

          <AuthTextField
            icon="mail-outline"
            placeholder="Email"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setFieldErrors((current) => ({...current, email: undefined}));
            }}
            error={fieldErrors.email}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
          />

          <AuthTextField
            icon="lock-closed-outline"
            placeholder="Password"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setFieldErrors((current) => ({...current, password: undefined}));
            }}
            error={fieldErrors.password}
            secure
            textContentType="newPassword"
            returnKeyType="next"
          />

          <AuthTextField
            icon="shield-checkmark-outline"
            placeholder="Confirm password"
            value={confirmPassword}
            onChangeText={(value) => {
              setConfirmPassword(value);
              setFieldErrors((current) => ({...current, confirmPassword: undefined}));
            }}
            error={fieldErrors.confirmPassword}
            secure
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={() => void handleRegister()}
            marginBottom={8}
          />

          {/* States the rule up front rather than only after a rejected submit. */}
          <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginLeft: 4}}>
            <Ionicons name="information-circle-outline" size={14} color={theme.textSubtle} />
            <Text style={{color: theme.textSubtle, ...theme.typography.caption, marginLeft: 6}}>
              At least {MIN_PASSWORD_LENGTH} characters.
            </Text>
          </View>

          <AuthPrimaryButton label="Create Account" onPress={() => void handleRegister()} loading={loading} />

          <View style={{flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 22}}>
            <Text style={{color: theme.textSubtle, ...theme.typography.body}}>Already have an account?</Text>
            <Pressable
              onPress={onGoToLogin}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Go to sign in"
              style={{marginLeft: 6, paddingVertical: 4}}>
              <Text style={{color: theme.accent, ...theme.typography.body, fontWeight: '800'}}>Sign In</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
