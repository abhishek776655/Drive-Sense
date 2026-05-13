import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://api-drive-sense.abhishek.homes';
let authExpiredHandler: ((message: string) => void) | null = null;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401 && error.config?.url !== '/api/v1/auth/login') {
      await AsyncStorage.removeItem('access_token');
      authExpiredHandler?.(getApiErrorMessage(error));
    }
    return Promise.reject(error);
  }
);

export const setAuthExpiredHandler = (handler: ((message: string) => void) | null) => {
  authExpiredHandler = handler;
};

export const getApiErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) {
      const detail = typeof error.response.data?.detail === 'string' ? error.response.data.detail : '';
      if (error.config?.url === '/api/v1/auth/login') {
        return detail || 'Invalid email or password.';
      }
      if (detail === 'User not found') {
        return 'Your account was not found on this server. Sign in again or check the backend data.';
      }
      return 'Your session expired. Sign in again to continue.';
    }
    if (!error.response) {
      return 'Unable to reach the server right now. Check your connection and try again.';
    }
    const detail =
      typeof error.response.data?.detail === 'string'
        ? error.response.data.detail
        : typeof error.message === 'string'
          ? error.message
          : '';
    if (detail) {
      return detail;
    }
    if (error.response.status >= 500) {
      return 'The server is having trouble right now. Please try again in a moment.';
    }
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
};

export const authService = {
  login: async (email: string, password: string) => {
    const response = await apiClient.post('/api/v1/auth/login', {email, password});
    const {access_token} = response.data;
    await AsyncStorage.setItem('access_token', access_token);
    return access_token;
  },
  me: async () => {
    const response = await apiClient.get('/api/v1/auth/me');
    return response.data;
  },
  logout: async () => {
    await AsyncStorage.removeItem('access_token');
  },
  getToken: () => AsyncStorage.getItem('access_token'),
};
