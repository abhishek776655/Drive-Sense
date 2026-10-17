import React, {useEffect, useRef, useState} from 'react';
import {Animated, Easing, KeyboardAvoidingView, Platform, Pressable, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {authService, getApiErrorMessage} from '../services/apiClient';
import {useAppTheme} from '../theme/appTheme';
import {AuthTextField} from '../components/AuthTextField';
import {AuthBackdrop, AuthErrorBanner, AuthPrimaryButton, BrandMark, Wordmark} from '../components/AuthChrome';

interface LoginScreenProps {
  initialError?: string;
  onLoginSuccess: () => void;
  onGoToRegister: () => void;
}

export type LoginFieldErrors = {
  email?: string;
  password?: string;
};

/**
 * Validates the sign-in form. Pure so the rules can be tested without rendering.
 *
 * Deliberately weaker than `validateRegistration`: an account created before today's password rules
 * must still be able to sign in, so length is never checked here — only presence and a shape that
 * could plausibly reach the server as an email.
 */
export const validateLogin = ({email, password}: {email: string; password: string}): LoginFieldErrors => {
  const errors: LoginFieldErrors = {};
  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    errors.email = 'Enter your email address.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errors.email = 'That does not look like an email address.';
  }

  if (!password) {
    errors.password = 'Enter your password.';
  }

  return errors;
};

export const LoginScreen: React.FC<LoginScreenProps> = ({initialError = '', onLoginSuccess, onGoToRegister}) => {
  const theme = useAppTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [error, setError] = useState(initialError);

  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setError(initialError);
  }, [initialError]);

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  const handleLogin = async () => {
    const errors = validateLogin({email, password});
    setFieldErrors(errors);
    setError('');
    if (Object.keys(errors).length > 0) {
      return;
    }

    setLoading(true);
    try {
      await authService.login(email.trim(), password);
      onLoginSuccess();
    } catch (loginError) {
      setError(getApiErrorMessage(loginError));
    } finally {
      setLoading(false);
    }
  };

  const headerStyle = {
    opacity: entrance,
    transform: [
      {
        translateY: entrance.interpolate({inputRange: [0, 1], outputRange: [18, 0]}),
      },
    ],
  };

  const formStyle = {
    opacity: entrance,
    transform: [
      {
        translateY: entrance.interpolate({inputRange: [0, 1], outputRange: [28, 0]}),
      },
    ],
  };

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: theme.screen}}>
      <AuthBackdrop />

      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{flex: 1, justifyContent: 'center', paddingHorizontal: 28}}>
          <Animated.View style={[{alignItems: 'center', marginBottom: 40}, headerStyle]}>
            <BrandMark />

            {/* Same mark-to-wordmark gap as sign-up, so the two screens don't shift on navigation. */}
            <View style={{marginTop: 16}}>
              <Wordmark />
            </View>
            <Text style={{color: theme.textSubtle, ...theme.typography.body, marginTop: 8, textAlign: 'center'}}>
              Know your drive. Every mile. Every detail.
            </Text>
          </Animated.View>

          <Animated.View style={formStyle}>
            {error ? <AuthErrorBanner message={error} /> : null}

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
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => void handleLogin()}
              marginBottom={20}
            />

            <AuthPrimaryButton label="Sign In" onPress={() => void handleLogin()} loading={loading} />

            <View style={{flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20}}>
              <Text style={{color: theme.textSubtle, ...theme.typography.body}}>New to DriveSense?</Text>
              <Pressable
                onPress={onGoToRegister}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Create an account"
                style={{marginLeft: 6, paddingVertical: 4}}>
                <Text style={{color: theme.accent, ...theme.typography.body, fontWeight: '800'}}>Create Account</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
