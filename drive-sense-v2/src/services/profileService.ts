import {PROFILE_CACHE_KEY, withOfflineCache} from '../db/offlineCache';
import {apiClient} from './apiClient';

export type DrivingFrequency = 'daily' | 'most' | 'weekends' | 'rarely';

export interface Profile {
  id: string;
  /** Optional recovery address; accounts are created with a handle. */
  email: string | null;
  handle: string | null;
  /** Versioned API path of the profile photo (needs the auth header), or null. */
  avatar_url: string | null;
  driving_frequency?: DrivingFrequency | null;
  /** Drives per week aimed for. */
  weekly_goal?: number | null;
  /** Null until onboarding's safety terms are accepted. */
  terms_accepted_at?: string | null;
}

/** What PATCH /auth/me accepts; send only what changed. */
export interface ProfilePatch {
  handle?: string;
  email?: string;
  driving_frequency?: DrivingFrequency;
  weekly_goal?: number;
  accept_terms?: true;
}

export interface HandleCheck {
  handle: string;
  available: boolean;
  reason: string | null;
}

export const profileService = {
  me: (): Promise<Profile> => withOfflineCache(PROFILE_CACHE_KEY, async () => (await apiClient.get<Profile>('/api/v1/auth/me')).data),
  checkHandle: async (handle: string): Promise<HandleCheck> =>
    (await apiClient.get<HandleCheck>('/api/v1/auth/handle-available', {params: {handle}})).data,
  /** Sign-up's check, before there is an account (no token needed). */
  checkHandleForSignup: async (handle: string): Promise<HandleCheck> =>
    (await apiClient.get<HandleCheck>('/api/v1/auth/handle-check', {params: {handle}})).data,
  update: async (patch: ProfilePatch): Promise<Profile> => (await apiClient.patch<Profile>('/api/v1/auth/me', patch)).data,
  /** 409 when taken, 422 when the format is wrong. */
  updateHandle: async (handle: string): Promise<Profile> => (await apiClient.patch<Profile>('/api/v1/auth/me', {handle})).data,
  uploadAvatar: async (data: string): Promise<Profile> => (await apiClient.put<Profile>('/api/v1/auth/me/avatar', {data})).data,
  removeAvatar: async (): Promise<Profile> => (await apiClient.delete<Profile>('/api/v1/auth/me/avatar')).data,
};
