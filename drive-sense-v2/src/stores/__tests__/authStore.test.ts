import {authService} from '../../services/apiClient';
import {useAuthStore} from '../authStore';

jest.mock('../../services/apiClient', () => ({
  authService: {getToken: jest.fn(), me: jest.fn(), login: jest.fn(), register: jest.fn(), logout: jest.fn()},
  getApiErrorMessage: () => 'message',
  setAuthExpiredHandler: jest.fn(),
}));

const api = authService as jest.Mocked<typeof authService>;
const httpError = (status: number) => Object.assign(new Error('fail'), {isAxiosError: true, response: {status}});

describe('authStore.bootstrap', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    useAuthStore.setState({status: 'checking', notice: ''});
  });

  it('signs in when the saved token is accepted', async () => {
    api.getToken.mockResolvedValue('t');
    api.me.mockResolvedValue(undefined as never);
    await useAuthStore.getState().bootstrap();
    expect(useAuthStore.getState().status).toBe('signedIn');
  });

  it('signs out when the server rejects the token', async () => {
    api.getToken.mockResolvedValue('t');
    api.me.mockRejectedValue(httpError(401));
    await useAuthStore.getState().bootstrap();
    expect(useAuthStore.getState().status).toBe('signedOut');
  });

  it('stays signed in when the server is down or the phone is offline', async () => {
    api.getToken.mockResolvedValue('t');
    api.me.mockRejectedValueOnce(httpError(502)).mockRejectedValueOnce(new Error('Network Error'));
    await useAuthStore.getState().bootstrap();
    expect(useAuthStore.getState().status).toBe('signedIn');
    useAuthStore.setState({status: 'checking'});
    await useAuthStore.getState().bootstrap();
    expect(useAuthStore.getState().status).toBe('signedIn');
  });
});

describe('authStore onboarding', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    useAuthStore.setState({status: 'signedOut', notice: '', onboarded: true});
  });

  it('sends a new account through onboarding', async () => {
    await useAuthStore.getState().register({handle: 'lazarus', password: 'longenough'});
    expect(api.register).toHaveBeenCalledWith({handle: 'lazarus', password: 'longenough'});
    expect(api.login).toHaveBeenCalledWith('lazarus', 'longenough');
    expect(useAuthStore.getState()).toMatchObject({status: 'signedIn', onboarded: false});
    useAuthStore.getState().markOnboarded();
    expect(useAuthStore.getState().onboarded).toBe(true);
  });

  it('resumes onboarding for an account that never accepted the terms', async () => {
    api.me.mockResolvedValue({terms_accepted_at: null} as never);
    await useAuthStore.getState().login('@lazarus', 'pw');
    expect(api.login).toHaveBeenCalledWith('@lazarus', 'pw');
    expect(useAuthStore.getState().onboarded).toBe(false);
    api.me.mockResolvedValue({terms_accepted_at: '2026-10-17T00:00:00Z'} as never);
    await useAuthStore.getState().login('demo@drivesense.com', 'pw');
    expect(useAuthStore.getState().onboarded).toBe(true);
  });
});
