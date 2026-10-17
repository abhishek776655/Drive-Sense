import {router} from 'expo-router';
import {useEffect} from 'react';
import {View} from 'react-native';
import {StepEnter} from '../components/onboarding/motion';
import {FrequencyStep, PhotoStep, RideStep, VehicleStep} from '../components/onboarding/profileSteps';
import {DoneStep, LocationStep, NotificationsStep, SafetyStep} from '../components/onboarding/setupSteps';
import {useAuthStore} from '../stores/authStore';
import {useOnboardingStore, type OnboardingStep} from '../stores/onboardingStore';
import {useProfileStore} from '../stores/profileStore';
import {useAppTheme} from '../theme/ThemeProvider';

const STEPS: Record<OnboardingStep, typeof PhotoStep> = {
  photo: PhotoStep,
  ride: RideStep,
  vehicle: VehicleStep,
  frequency: FrequencyStep,
  location: LocationStep,
  notifications: NotificationsStep,
  safety: SafetyStep,
  done: DoneStep,
};

/**
 * Onboarding steps 2–9 for a new, signed-in account (spec 2026-10-17, onboarding). The root stack
 * only offers this screen until onboarding is finished. Each step slides in from the side it is
 * travelling from; progress is saved, so a relaunch resumes the same step.
 */
export default function OnboardingScreen() {
  const c = useAppTheme().colors;
  const {step, direction, hydrated, hydrate, next, back, reset} = useOnboardingStore();
  const loadProfile = useProfileStore((s) => s.load);
  const markOnboarded = useAuthStore((s) => s.markOnboarded);

  useEffect(() => {
    void hydrate();
    void loadProfile();
  }, [hydrate, loadProfile]);

  const finish = () => {
    reset();
    markOnboarded();
    // The tabs become available on the next render; open the Drive tab then.
    requestAnimationFrame(() => router.replace('/drive'));
  };

  const Step = STEPS[step];
  return (
    <View style={{flex: 1, backgroundColor: c.accent}}>
      {hydrated ? (
        <StepEnter key={step} direction={direction}>
          <Step onNext={step === 'done' ? finish : next} onBack={step === 'photo' ? undefined : back} />
        </StepEnter>
      ) : null}
    </View>
  );
}
