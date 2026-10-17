import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';
import type {VehicleType} from '../services/vehicleService';
import type {DrivingFrequency} from '../services/profileService';
import type {Preferences} from './preferencesStore';

/** The signed-in part of onboarding, in order (account creation comes before, on /signup). */
export const ONBOARDING_STEPS = ['photo', 'ride', 'vehicle', 'frequency', 'location', 'notifications', 'safety', 'done'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

const KEY = 'onboarding_v1';

export const nextStep = (step: OnboardingStep): OnboardingStep =>
  ONBOARDING_STEPS[Math.min(ONBOARDING_STEPS.indexOf(step) + 1, ONBOARDING_STEPS.length - 1)];

export const prevStep = (step: OnboardingStep): OnboardingStep => ONBOARDING_STEPS[Math.max(ONBOARDING_STEPS.indexOf(step) - 1, 0)];

/** Settings that follow from how often they drive (spec 2026-10-17, onboarding: smart defaults). */
export const frequencyDefaults = (frequency: DrivingFrequency): Partial<Preferences> => {
  if (frequency === 'rarely') {
    // An occasional driver's phone shouldn't sit watching for a drive that rarely comes.
    return {autoStart: false};
  }
  if (frequency === 'daily' || frequency === 'most') {
    return {autoStart: true, powerMode: 'balanced'};
  }
  return {};
};

interface OnboardingState {
  step: OnboardingStep;
  /** Which way the last move went, so the next page slides in from the matching side. */
  direction: 1 | -1;
  rideType: VehicleType;
  /** The vehicle this onboarding created, so going back and forward edits it instead of adding another. */
  vehicleId: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  next: () => void;
  back: () => void;
  setRideType: (rideType: VehicleType) => void;
  setVehicleId: (vehicleId: string) => void;
  reset: () => void;
}

const sanitizeStep = (value: unknown): OnboardingStep =>
  (ONBOARDING_STEPS as readonly string[]).includes(value as string) ? (value as OnboardingStep) : 'photo';

/**
 * Where a new account is in onboarding. Saved on every move, so quitting the app mid-way resumes
 * at the same page; cleared when onboarding finishes or the user signs out.
 */
export const useOnboardingStore = create<OnboardingState>((set, get) => {
  const persist = () => {
    const {step, rideType, vehicleId} = get();
    AsyncStorage.setItem(KEY, JSON.stringify({step, rideType, vehicleId})).catch(() => undefined);
  };
  return {
    step: 'photo',
    direction: 1,
    rideType: 'car',
    vehicleId: null,
    hydrated: false,
    hydrate: async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        const saved = raw ? (JSON.parse(raw) as {step?: unknown; rideType?: unknown; vehicleId?: unknown}) : {};
        set({
          step: sanitizeStep(saved.step),
          rideType: saved.rideType === 'motorbike' ? 'motorbike' : 'car',
          vehicleId: typeof saved.vehicleId === 'string' ? saved.vehicleId : null,
          hydrated: true,
        });
      } catch {
        set({hydrated: true});
      }
    },
    next: () => {
      set({step: nextStep(get().step), direction: 1});
      persist();
    },
    back: () => {
      set({step: prevStep(get().step), direction: -1});
      persist();
    },
    setRideType: (rideType) => {
      set({rideType});
      persist();
    },
    setVehicleId: (vehicleId) => {
      set({vehicleId});
      persist();
    },
    reset: () => {
      set({step: 'photo', direction: 1, rideType: 'car', vehicleId: null});
      AsyncStorage.removeItem(KEY).catch(() => undefined);
    },
  };
});
