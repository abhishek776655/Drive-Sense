import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {authService, getApiErrorMessage} from '../services/apiClient';
import {useAppTheme} from '../theme/appTheme';
import {AuthTextField} from '../components/AuthTextField';
import {BrandMark} from '../components/AuthChrome';

interface LoginScreenProps {
  initialError?: string;
  onLoginSuccess: () => void;
  onGoToRegister: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({initialError = '', onLoginSuccess, onGoToRegister}) => {
  const theme = useAppTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
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
    setLoading(true);
    setError('');
    try {
      await authService.login(email, password);
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
      <View pointerEvents="none" style={{position: 'absolute', top: -120, left: -60, width: 280, height: 280, borderRadius: 140, backgroundColor: theme.screenGlow, opacity: theme.dark ? 0.6 : 0.9}} />
      <View pointerEvents="none" style={{position: 'absolute', top: -40, right: -90, width: 220, height: 220, borderRadius: 110, backgroundColor: theme.accentSoft, opacity: theme.dark ? 0.5 : 0.7}} />

      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{flex: 1, justifyContent: 'center', paddingHorizontal: 28}}>
          <Animated.View style={[{alignItems: 'center', marginBottom: 40}, headerStyle]}>
            <BrandMark />

            <View style={{flexDirection: 'row'}}>
              <Text style={{color: theme.text, ...theme.typography.pageTitle, fontSize: 34, lineHeight: 40}}>Drive</Text>
              <Text style={{color: theme.accent, ...theme.typography.pageTitle, fontSize: 34, lineHeight: 40}}>Sense</Text>
            </View>
            <Text style={{color: theme.textSubtle, ...theme.typography.body, marginTop: 8, textAlign: 'center'}}>
              Know your drive. Every mile. Every detail.
            </Text>
          </Animated.View>

          <Animated.View style={formStyle}>
            {error ? (
              <View
                style={{
                  marginBottom: 14,
                  borderRadius: 16,
                  padding: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: theme.dangerSoft,
                  borderWidth: 1,
                  borderColor: theme.danger,
                }}>
                <Ionicons name="alert-circle" size={16} color={theme.danger} />
                <Text style={{flex: 1, marginLeft: 8, color: theme.danger, ...theme.typography.caption, fontWeight: '700'}}>
                  {error}
                </Text>
              </View>
            ) : null}

            <AuthTextField
              icon="mail-outline"
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
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
              onChangeText={setPassword}
              secure
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => void handleLogin()}
              marginBottom={20}
            />

            <TouchableOpacity
              onPress={() => void handleLogin()}
              disabled={loading}
              activeOpacity={0.85}
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 18,
                height: 54,
                backgroundColor: theme.accent,
                opacity: loading ? 0.7 : 1,
                shadowColor: theme.accent,
                shadowOpacity: 0.28,
                shadowRadius: 16,
                shadowOffset: {width: 0, height: 8},
                elevation: 6,
              }}>
              {loading ? (
                <ActivityIndicator color={theme.onAccent} />
              ) : (
                <Text style={{color: theme.onAccent, ...theme.typography.body, fontWeight: '800', fontSize: 16}}>Sign In</Text>
              )}
            </TouchableOpacity>

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
