import {create} from 'zustand';
import {getApiErrorMessage} from '../services/apiClient';
import {profileService, type Profile, type ProfilePatch} from '../services/profileService';

interface ProfileState {
  profile: Profile | null;
  load: () => Promise<void>;
  /** Throws a readable message (taken, bad format, offline). */
  saveHandle: (handle: string) => Promise<void>;
  /** Base64 JPEG, or null to remove the photo. Throws a readable message. */
  setAvatar: (data: string | null) => Promise<void>;
  /** Saves onboarding answers and settings (frequency, goal, terms). Throws a readable message. */
  update: (patch: ProfilePatch) => Promise<void>;
  clear: () => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  load: async () => {
    try {
      set({profile: await profileService.me()});
    } catch {
      // The profile card falls back to "Your account" until it loads.
    }
  },
  saveHandle: async (handle) => {
    try {
      set({profile: await profileService.updateHandle(handle)});
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'Could not save your handle.'));
    }
  },
  setAvatar: async (data) => {
    try {
      set({profile: data ? await profileService.uploadAvatar(data) : await profileService.removeAvatar()});
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'Could not save the photo.'));
    }
  },
  update: async (patch) => {
    try {
      set({profile: await profileService.update(patch)});
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'Could not save that.'));
    }
  },
  clear: () => set({profile: null}),
}));
