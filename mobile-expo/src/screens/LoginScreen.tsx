import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Text, TextInput, TouchableOpacity, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {authService, getApiErrorMessage} from '../services/apiClient';
import {useAppTheme} from '../theme/appTheme';

interface LoginScreenProps {
  initialError?: string;
  onLoginSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({initialError = '', onLoginSuccess}) => {
  const theme = useAppTheme();
  const [email, setEmail] = useState('demo@drivesense.com');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);

  useEffect(() => {
    setError(initialError);
  }, [initialError]);

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

  return (
    <SafeAreaView className="flex-1" style={{backgroundColor: theme.screen}}>
      <View className="flex-1 justify-center px-6">
        <View className="mb-10 items-center">
          <View
            className="mb-4 items-center justify-center"
            style={{
              width: 88,
              height: 88,
              borderRadius: 28,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.cardBorder,
            }}>
            <Ionicons name="car-sport" size={42} color={theme.accent} />
          </View>
          <Text style={{color: theme.text, fontSize: 32, fontWeight: '800'}}>Drive</Text>
          <Text className="-mt-1.5" style={{color: theme.accent, fontSize: 32, fontWeight: '800'}}>Sense</Text>
          <Text className="mt-2.5 text-center" style={{color: theme.textSubtle, fontSize: 14}}>
            Know your drive.{'\n'}Every mile. Every detail.
          </Text>
        </View>

        {error ? (
          <View
            className="mb-3 rounded-2xl p-3"
            style={{
              backgroundColor: 'rgba(239,68,68,0.12)',
              borderWidth: 1,
              borderColor: 'rgba(239,68,68,0.2)',
            }}>
            <Text className="text-center" style={{color: theme.danger, fontSize: 12}}>{error}</Text>
          </View>
        ) : null}

        <TextInput
          className="mb-3 rounded-[18px] border px-4 py-3.5"
          style={{
            backgroundColor: theme.card,
            color: theme.text,
            borderColor: theme.cardBorder,
          }}
          placeholder="Email"
          placeholderTextColor={theme.textSubtle}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          className="mb-[18px] rounded-[18px] border px-4 py-3.5"
          style={{
            backgroundColor: theme.card,
            color: theme.text,
            borderColor: theme.cardBorder,
          }}
          placeholder="Password"
          placeholderTextColor={theme.textSubtle}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          onPress={handleLogin}
          disabled={loading}
          className="items-center rounded-[18px] py-4"
          style={{
            backgroundColor: theme.accent,
          }}>
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{color: '#FFFFFF', fontWeight: '800'}}>Sign In</Text>}
        </TouchableOpacity>

        <Text className="mt-[18px] text-center" style={{color: theme.textSubtle, fontSize: 12}}>
          Demo: demo@drivesense.com / password123
        </Text>
      </View>
    </SafeAreaView>
  );
};
