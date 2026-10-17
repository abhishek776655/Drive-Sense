import {create} from 'zustand';
import {authService, getApiErrorMessage, setAuthExpiredHandler, type SignupInput} from '../services/apiClient';
import {wipeDb} from '../db';
import {useOnboardingStore} from './onboardingStore';

type AuthStatus = 'checking' | 'signedOut' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  /** Why the user was sent back to login (expired session). Empty after a deliberate logout. */
  notice: string;
  /**
   * Past onboarding (safety terms accepted). A new account is signed in but not onboarded, which
   * sends it through the onboarding steps. Unknown (offline at launch) counts as onboarded.
   */
  onboarded: boolean;
  bootstrap: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  register: (input: SignupInput) => Promise<void>;
  markOnboarded: () => void;
  logout: () => Promise<void>;
}

/** `me()` says so explicitly: only a null `terms_accepted_at` means onboarding is unfinished. */
const isOnboarded = (me: unknown) => (me as {terms_accepted_at?: string | null} | undefined)?.terms_accepted_at !== null;

export const useAuthStore = create<AuthState>((set) => ({
  status: 'checking',
  notice: '',
  onboarded: true,
  bootstrap: async () => {
    setAuthExpiredHandler((message) => set({status: 'signedOut', notice: message}));
    const token = await authService.getToken();
    if (!token) {
      set({status: 'signedOut'});
      return;
    }
    try {
      const me = await authService.me();
      set({status: 'signedIn', onboarded: isOnboarded(me)});
    } catch (error) {
      // Only a rejected token ends the session. A server restart or no signal at launch keeps
      // the user signed in; their requests retry, and a real expiry still lands on the 401 handler.
      const status = (error as {response?: {status?: number}})?.response?.status;
      set(status === 401 || status === 403 ? {status: 'signedOut', notice: getApiErrorMessage(error)} : {status: 'signedIn', onboarded: true});
    }
  },
  login: async (identifier, password) => {
    await authService.login(identifier, password);
    let onboarded = true;
    try {
      onboarded = isOnboarded(await authService.me());
    } catch {
      // Signed in either way; onboarding is only offered when the server says it is unfinished.
    }
    set({status: 'signedIn', notice: '', onboarded});
  },
  register: async (input) => {
    await authService.register(input);
    await authService.login(input.handle, input.password);
    set({status: 'signedIn', notice: '', onboarded: false});
  },
  markOnboarded: () => set({onboarded: true}),
  logout: async () => {
    await authService.logout();
    // A half-finished onboarding and the phone's copy of the drives belong to the account that
    // signed out.
    useOnboardingStore.getState().reset();
    wipeDb();
    set({status: 'signedOut', notice: ''});
  },
}));
