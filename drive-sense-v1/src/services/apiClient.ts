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

// Reuses the same "return to login" wiring as a 401-triggered session expiry, but with no error
// message since this is a deliberate, successful logout rather than a failure.
export const notifyLoggedOut = () => {
  authExpiredHandler?.('');
};

const SERVER_ERROR_MESSAGE = 'The server is having trouble right now. Please try again in a moment.';

/** Matches axios's own failure text, which carries a bare HTTP status code. */
const STATUS_CODE_MESSAGE = /request failed with status code\s*(\d{3})/i;

/**
 * Keeps raw HTTP status text out of user-facing copy. A non-axios `Error` can still originate from
 * the network layer, so its message is filtered rather than trusted.
 */
export const sanitizeErrorText = (
  message: string,
  fallback = 'Something went wrong. Please try again.',
): string => {
  const match = message.match(STATUS_CODE_MESSAGE);
  if (!match) {
    return message;
  }
  return Number(match[1]) >= 500 ? SERVER_ERROR_MESSAGE : fallback;
};

/**
 * User-facing text for a failed request. `fallback` supplies the caller's context for the cases
 * where the error itself says nothing usable; it never overrides the specific network/auth/server
 * wording below.
 */
export const getApiErrorMessage = (
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
) => {
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
    // Checked before any detail is read. A 5xx body is server-side wording ("Internal Server
    // Error", a stack trace, a driver message) written for operators, and axios's own
    // error.message is literally "Request failed with status code 500" — none of that belongs in
    // front of a user.
    if (error.response.status >= 500) {
      return SERVER_ERROR_MESSAGE;
    }
    const detail = typeof error.response.data?.detail === 'string' ? error.response.data.detail : '';
    if (detail) {
      return detail;
    }
    return fallback;
  }
  return error instanceof Error ? sanitizeErrorText(error.message, fallback) : fallback;
};

export const authService = {
  register: async (email: string, password: string) => {
    const response = await apiClient.post('/api/v1/auth/register', {email, password});
    return response.data;
  },
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
