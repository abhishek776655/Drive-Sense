import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {authService, getApiErrorMessage} from '../services/apiClient';
import {useAppTheme} from '../theme/appTheme';

interface LoginScreenProps {
  initialError?: string;
  onLoginSuccess: () => void;
}

const DEMO_EMAIL = 'demo@drivesense.com';
const DEMO_PASSWORD = 'password123';

export const LoginScreen: React.FC<LoginScreenProps> = ({initialError = '', onLoginSuccess}) => {
  const theme = useAppTheme();
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
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

  const fillDemoCredentials = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
  };

  const isDemoFilled = email === DEMO_EMAIL && password === DEMO_PASSWORD;

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
            <View
              style={{
                width: 92,
                height: 92,
                borderRadius: 30,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 18,
                backgroundColor: theme.card,
                borderWidth: 1,
                borderColor: theme.accentSoft,
                shadowColor: theme.accent,
                shadowOpacity: theme.dark ? 0.35 : 0.22,
                shadowRadius: 22,
                shadowOffset: {width: 0, height: 12},
                elevation: 10,
              }}>
              {/* Speedometer-gauge arc: a driving-brand mark, not a stock icon-in-a-box */}
              <View
                style={{
                  position: 'absolute',
                  width: 66,
                  height: 66,
                  borderRadius: 33,
                  borderWidth: 5,
                  borderTopColor: theme.accent,
                  borderRightColor: theme.accent,
                  borderLeftColor: theme.accent,
                  borderBottomColor: 'transparent',
                  transform: [{rotate: '45deg'}],
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  width: 66,
                  height: 66,
                  borderRadius: 33,
                  borderWidth: 5,
                  borderTopColor: theme.accentSoft,
                  borderRightColor: 'transparent',
                  borderLeftColor: 'transparent',
                  borderBottomColor: 'transparent',
                  transform: [{rotate: '45deg'}],
                }}
              />
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.card,
                }}>
                <Ionicons name="car-sport" size={26} color={theme.accent} />
              </View>
            </View>
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

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 12,
                borderRadius: 18,
                borderWidth: 1.5,
                paddingHorizontal: 16,
                height: 54,
                backgroundColor: theme.card,
                borderColor: emailFocused ? theme.accent : theme.cardBorder,
              }}>
              <Ionicons name="mail-outline" size={18} color={emailFocused ? theme.accent : theme.textSubtle} />
              <TextInput
                style={{flex: 1, marginLeft: 12, color: theme.text, ...theme.typography.body, paddingVertical: 0}}
                placeholder="Email"
                placeholderTextColor={theme.textSubtle}
                value={email}
                onChangeText={setEmail}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="next"
              />
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 20,
                borderRadius: 18,
                borderWidth: 1.5,
                paddingHorizontal: 16,
                height: 54,
                backgroundColor: theme.card,
                borderColor: passwordFocused ? theme.accent : theme.cardBorder,
              }}>
              <Ionicons name="lock-closed-outline" size={18} color={passwordFocused ? theme.accent : theme.textSubtle} />
              <TextInput
                style={{flex: 1, marginLeft: 12, color: theme.text, ...theme.typography.body, paddingVertical: 0}}
                placeholder="Password"
                placeholderTextColor={theme.textSubtle}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                secureTextEntry={!passwordVisible}
                returnKeyType="go"
                onSubmitEditing={() => void handleLogin()}
              />
              <Pressable onPress={() => setPasswordVisible((current) => !current)} hitSlop={10}>
                <Ionicons name={passwordVisible ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.textSubtle} />
              </Pressable>
            </View>

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

            <Pressable
              onPress={fillDemoCredentials}
              style={{
                marginTop: 18,
                alignSelf: 'center',
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: 999,
                paddingHorizontal: 14,
                paddingVertical: 8,
                backgroundColor: theme.chip,
              }}>
              <Ionicons name={isDemoFilled ? 'checkmark-circle' : 'flash-outline'} size={14} color={theme.chipText} />
              <Text style={{marginLeft: 6, color: theme.chipText, ...theme.typography.caption, fontWeight: '700'}}>
                {isDemoFilled ? 'Demo account ready' : 'Use demo account'}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
