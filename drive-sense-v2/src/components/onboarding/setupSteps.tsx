import {Ionicons} from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import {useState, type ComponentProps} from 'react';
import {Alert, Pressable, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {requestNotificationPermission} from '../../notifications/driveNotifications';
import {useProfileStore} from '../../stores/profileStore';
import {withAlpha} from '../../theme/color';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {BenefitRow, DoneCheck, NotificationArt, RouteArt} from './art';
import {GhostButton, PillButton} from './controls';
import {FadeUp} from './motion';
import {OnboardingShell} from './OnboardingShell';
import type {StepProps} from './profileSteps';

/**
 * Step 6: location. Asks for While Using, then Always (background recording and auto-start need
 * it). Saying no still moves on; the app asks again when a drive starts.
 */
export function LocationStep({onNext, onBack}: StepProps) {
  const [asking, setAsking] = useState(false);
  const ask = async () => {
    setAsking(true);
    try {
      const foreground = await Location.requestForegroundPermissionsAsync();
      if (foreground.status === 'granted') {
        await Location.requestBackgroundPermissionsAsync().catch(() => undefined);
      }
    } catch {
      // A permission prompt that fails to show is not worth stopping onboarding for.
    } finally {
      setAsking(false);
      onNext();
    }
  };
  return (
    <OnboardingShell
      step={6}
      onBack={onBack}
      title="Stay on the road"
      subtitle="DriveSense needs your location to record every drive. Choose Always so it works with the phone in your pocket."
      footer={<PillButton label="Allow location" onPress={ask} busy={asking} />}>
      <FadeUp index={2}>
        <RouteArt />
      </FadeUp>
      <FadeUp index={3} style={{gap: 18, marginTop: 8}}>
        <BenefitRow icon="navigate" text="Records every drive by itself, no tapping Start" />
        <BenefitRow icon="map" text="Shows your real route on a clean map" />
        <BenefitRow icon="lock-closed" text="Your drives are yours: export or delete them any time" />
      </FadeUp>
    </OnboardingShell>
  );
}

/** Step 7: notifications ("Drive saved", "You forgot to end your drive"). Not now skips. */
export function NotificationsStep({onNext, onBack}: StepProps) {
  const [asking, setAsking] = useState(false);
  const ask = async () => {
    setAsking(true);
    await requestNotificationPermission();
    setAsking(false);
    onNext();
  };
  return (
    <OnboardingShell
      step={7}
      onBack={onBack}
      title="Stay in the loop"
      subtitle="Drive summaries, a nudge when a drive is left running, and your weekly goal."
      footer={
        <>
          <PillButton label="Allow notifications" onPress={ask} busy={asking} />
          <GhostButton label="Not now" onPress={onNext} />
        </>
      }>
      <NotificationArt />
    </OnboardingShell>
  );
}

const TERMS: {icon: ComponentProps<typeof Ionicons>['name']; title: string; body: string}[] = [
  {icon: 'eye', title: 'Stay focused', body: "Never use the app while driving. Handling a phone at the wheel is against the law in most places and puts lives at risk."},
  {icon: 'person', title: 'Your responsibility', body: 'You are responsible for how you drive, your safety, and following the rules of the road.'},
  {icon: 'book', title: 'Follow the law', body: 'Always obey traffic laws and speed limits. DriveSense does not encourage speeding or risky driving.'},
  {icon: 'speedometer', title: 'No accuracy guarantee', body: 'Speed, distance and location come from GPS and can be wrong. They are not fit for legal, safety or navigation use.'},
  {icon: 'hand-left', title: 'Limitation of liability', body: 'The developer is not liable for damage caused by improper use of the app.'},
  {icon: 'shield-checkmark', title: 'Your data', body: 'Drives are stored on your DriveSense account. Export or delete them in Settings whenever you like.'},
];

/** Step 8: the safety terms. Continue stays dimmed until the box is ticked. */
export function SafetyStep({onNext, onBack}: StepProps) {
  const c = useAppTheme().colors;
  const updateProfile = useProfileStore((s) => s.update);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  const accept = async () => {
    setSaving(true);
    try {
      await updateProfile({accept_terms: true});
      onNext();
    } catch (e) {
      Alert.alert('Safety terms', e instanceof Error ? e.message : 'Could not save that. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingShell
      step={8}
      onBack={onBack}
      title="Safety first"
      subtitle="Read and accept before you start."
      footer={
        <>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{checked: accepted}}
            accessibilityLabel="I have read and accept these terms"
            onPress={() => {
              void Haptics.selectionAsync().catch(() => undefined);
              setAccepted((v) => !v);
            }}
            style={{flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 28, backgroundColor: withAlpha(c.onAccent, 0.14), marginBottom: 8}}>
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                backgroundColor: accepted ? c.onAccent : 'transparent',
                borderWidth: 2,
                borderColor: c.onAccent,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              {accepted ? <Ionicons name="checkmark" size={20} color={c.accentDeep} /> : null}
            </View>
            <AppText size={16} weight="black" color={c.onAccent} style={{flex: 1}}>
              I have read and accept these terms
            </AppText>
          </Pressable>
          <PillButton label="Continue" onPress={accept} disabled={!accepted} busy={saving} />
        </>
      }>
      {TERMS.map((t, i) => (
        <FadeUp key={t.title} index={2 + i} style={{flexDirection: 'row', gap: 16, marginBottom: 6}}>
          <View style={{width: 40, height: 40, borderRadius: 20, backgroundColor: withAlpha(c.onAccent, 0.18), alignItems: 'center', justifyContent: 'center'}}>
            <Ionicons name={t.icon} size={19} color={c.onAccent} />
          </View>
          <View style={{flex: 1, gap: 3}}>
            <AppText size={17} weight="black" color={c.onAccent}>
              {t.title}
            </AppText>
            <AppText size={14} weight="semibold" color={withAlpha(c.onAccent, 0.85)}>
              {t.body}
            </AppText>
          </View>
        </FadeUp>
      ))}
    </OnboardingShell>
  );
}

/** Step 9: done. Its own layout: the check and the greeting centred, Start driving at the bottom. */
export function DoneStep({onNext}: StepProps) {
  const c = useAppTheme().colors;
  const insets = useSafeAreaInsets();
  const handle = useProfileStore((s) => s.profile?.handle);
  return (
    <View style={{flex: 1, backgroundColor: c.accent, paddingHorizontal: 24, paddingTop: insets.top, paddingBottom: insets.bottom + 16}}>
      <View style={{flex: 1, justifyContent: 'center', gap: 26}}>
        <DoneCheck />
        <FadeUp index={4}>
          <AppText size={46} weight="black" color={c.onAccent} style={{lineHeight: 52}}>
            {handle ? `You're in,\n@${handle}.` : "You're in."}
          </AppText>
        </FadeUp>
        <FadeUp index={6}>
          <AppText size={18} weight="semibold" color={withAlpha(c.onAccent, 0.85)}>
            Your first drive is waiting.
          </AppText>
        </FadeUp>
      </View>
      <FadeUp index={8}>
        <PillButton label="Start driving" onPress={onNext} />
      </FadeUp>
    </View>
  );
}
