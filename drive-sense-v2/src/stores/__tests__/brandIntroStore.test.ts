import AsyncStorage from '@react-native-async-storage/async-storage';
import {useBrandIntroStore} from '../brandIntroStore';

beforeEach(() => {
  useBrandIntroStore.setState({hydrated: false, seen: false});
});

describe('brand intro gate', () => {
  it('plays on a fresh install', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    await useBrandIntroStore.getState().hydrate();
    expect(useBrandIntroStore.getState()).toMatchObject({hydrated: true, seen: false});
  });

  it('is skipped once it has played', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('1');
    await useBrandIntroStore.getState().hydrate();
    expect(useBrandIntroStore.getState()).toMatchObject({hydrated: true, seen: true});
  });

  it('still lets the app start when storage fails', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('disk'));
    await useBrandIntroStore.getState().hydrate();
    expect(useBrandIntroStore.getState()).toMatchObject({hydrated: true, seen: false});
  });

  it('remembers that it played', () => {
    useBrandIntroStore.getState().markSeen();
    expect(useBrandIntroStore.getState().seen).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('brand_intro_seen_v1', '1');
  });
});
