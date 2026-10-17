import {AxiosError, AxiosHeaders} from 'axios';
import {profileService, type Profile} from '../../services/profileService';
import {useProfileStore} from '../profileStore';

jest.mock('../../services/profileService', () => ({
  profileService: {me: jest.fn(), checkHandle: jest.fn(), updateHandle: jest.fn(), uploadAvatar: jest.fn(), removeAvatar: jest.fn()},
}));

const service = profileService as jest.Mocked<typeof profileService>;
const profile = (overrides: Partial<Profile> = {}): Profile => ({id: 'u1', email: 'a@b.c', handle: null, avatar_url: null, ...overrides});

describe('profileStore', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    useProfileStore.setState({profile: null});
  });

  it('loads and saves the handle', async () => {
    service.me.mockResolvedValueOnce(profile());
    await useProfileStore.getState().load();
    service.updateHandle.mockResolvedValueOnce(profile({handle: 'lazarus'}));
    await useProfileStore.getState().saveHandle('lazarus');
    expect(useProfileStore.getState().profile?.handle).toBe('lazarus');
  });

  it('passes the server reason through when a handle is taken', async () => {
    const config = {url: '/api/v1/auth/me', headers: new AxiosHeaders()} as never;
    const error = new AxiosError('Conflict', '409', config);
    error.response = {status: 409, data: {detail: 'That handle is taken'}, statusText: '', headers: {}, config} as never;
    service.updateHandle.mockRejectedValueOnce(error);
    await expect(useProfileStore.getState().saveHandle('taken')).rejects.toThrow('That handle is taken');
  });

  it('uploads or removes the photo', async () => {
    service.uploadAvatar.mockResolvedValueOnce(profile({avatar_url: '/a?v=1'}));
    await useProfileStore.getState().setAvatar('abc');
    expect(useProfileStore.getState().profile?.avatar_url).toBe('/a?v=1');
    service.removeAvatar.mockResolvedValueOnce(profile());
    await useProfileStore.getState().setAvatar(null);
    expect(useProfileStore.getState().profile?.avatar_url).toBeNull();
  });
});
