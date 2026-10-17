import AsyncStorage from '@react-native-async-storage/async-storage';
import {frequencyDefaults, nextStep, ONBOARDING_STEPS, prevStep, useOnboardingStore} from '../onboardingStore';

beforeEach(() => {
  useOnboardingStore.setState({step: 'photo', direction: 1, rideType: 'car', vehicleId: null, hydrated: false});
});

describe('onboarding steps', () => {
  it('walks forward and back, stopping at both ends', () => {
    expect(ONBOARDING_STEPS[0]).toBe('photo');
    expect(nextStep('photo')).toBe('ride');
    expect(nextStep('done')).toBe('done');
    expect(prevStep('photo')).toBe('photo');
    expect(prevStep('safety')).toBe('backup');
    expect(prevStep('backup')).toBe('notifications');
  });

  it('remembers the direction so the next page slides in from the right side', () => {
    useOnboardingStore.getState().next();
    expect(useOnboardingStore.getState()).toMatchObject({step: 'ride', direction: 1});
    useOnboardingStore.getState().back();
    expect(useOnboardingStore.getState()).toMatchObject({step: 'photo', direction: -1});
  });

  it('resumes where the user left off, and forgets on reset', async () => {
    useOnboardingStore.getState().setRideType('motorbike');
    useOnboardingStore.getState().next();
    useOnboardingStore.getState().setVehicleId('v1');
    const saved = (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)[1];
    expect(JSON.parse(saved)).toEqual({step: 'ride', rideType: 'motorbike', vehicleId: 'v1'});

    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(saved);
    useOnboardingStore.setState({step: 'photo', rideType: 'car', vehicleId: null});
    await useOnboardingStore.getState().hydrate();
    expect(useOnboardingStore.getState()).toMatchObject({step: 'ride', rideType: 'motorbike', vehicleId: 'v1', hydrated: true});

    useOnboardingStore.getState().reset();
    expect(useOnboardingStore.getState()).toMatchObject({step: 'photo', vehicleId: null});
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('onboarding_v1');
  });

  it('ignores a stored step it does not know', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify({step: 'tutorial'}));
    await useOnboardingStore.getState().hydrate();
    expect(useOnboardingStore.getState().step).toBe('photo');
  });
});

describe('frequency defaults', () => {
  it('keeps auto-start on for regular drivers and off for occasional ones', () => {
    expect(frequencyDefaults('daily')).toEqual({autoStart: true, powerMode: 'balanced'});
    expect(frequencyDefaults('most')).toEqual({autoStart: true, powerMode: 'balanced'});
    expect(frequencyDefaults('weekends')).toEqual({});
    expect(frequencyDefaults('rarely')).toEqual({autoStart: false});
  });
});
