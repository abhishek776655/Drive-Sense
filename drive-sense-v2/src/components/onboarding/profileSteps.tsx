import {Ionicons} from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {useState} from 'react';
import {ActionSheetIOS, ActivityIndicator, Alert, Keyboard, LayoutAnimation, Platform, Pressable, View} from 'react-native';
import {makesFor, modelsFor} from '../../data/vehicleCatalog';
import type {DrivingFrequency} from '../../services/profileService';
import type {FuelType, VehicleInput} from '../../services/vehicleService';
import {frequencyDefaults, useOnboardingStore} from '../../stores/onboardingStore';
import {usePreferencesStore} from '../../stores/preferencesStore';
import {useProfileStore} from '../../stores/profileStore';
import {useVehicleStore} from '../../stores/vehicleStore';
import {withAlpha} from '../../theme/color';
import {useAppTheme} from '../../theme/ThemeProvider';
import {pickVehiclePhoto, type PhotoSource} from '../../utils/vehiclePhoto';
import {AppText} from '../AppText';
import {VehicleIcon} from '../garage/VehicleIcon';
import {Avatar} from '../profile/Avatar';
import {ChoiceCard, GhostButton, LineField, LinePicker, PillButton} from './controls';
import {FadeUp} from './motion';
import {OnboardingShell} from './OnboardingShell';

export interface StepProps {
  onNext: () => void;
  onBack?: () => void;
}

const failed = (title: string, e: unknown) => Alert.alert(title, e instanceof Error ? e.message : 'Something went wrong. Try again.');

/** Step 2: an optional profile photo, taken or picked, shown big in a white ring. */
export function PhotoStep({onNext}: StepProps) {
  const c = useAppTheme().colors;
  const profile = useProfileStore((s) => s.profile);
  const setAvatar = useProfileStore((s) => s.setAvatar);
  const [uploading, setUploading] = useState(false);
  const hasPhoto = profile?.avatar_url != null;

  const save = async (source: PhotoSource) => {
    try {
      const data = await pickVehiclePhoto(source, [1, 1]);
      if (data == null) {
        return;
      }
      setUploading(true);
      await setAvatar(data);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (e) {
      failed('Photo', e);
    } finally {
      setUploading(false);
    }
  };

  const choose = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Take Photo', 'Choose from Library', 'Cancel'],
          cancelButtonIndex: 2,
          tintColor: c.accent,
        },
        (i) => {
          if (i === 0 || i === 1) {
            void save(i === 0 ? 'camera' : 'library');
          }
        },
      );
    } else {
      Alert.alert('Profile photo', undefined, [
        {text: 'Take Photo', onPress: () => void save('camera')},
        {text: 'Choose from Library', onPress: () => void save('library')},
        {text: 'Cancel', style: 'cancel'},
      ]);
    }
  };

  return (
    <OnboardingShell
      step={2}
      title={profile?.handle ? `Hi, @${profile.handle}` : 'Your photo'}
      subtitle="Add a profile picture so your drives feel like yours. You can skip this."
      footer={
        <>
          <PillButton label={hasPhoto ? 'Next' : 'Add profile picture'} onPress={hasPhoto ? onNext : choose} busy={uploading} />
          {hasPhoto ? null : <GhostButton label="Skip for now" onPress={onNext} />}
        </>
      }>
      <FadeUp index={2} style={{alignItems: 'center', marginTop: 24}}>
        <Pressable accessibilityRole="button" accessibilityLabel="Choose a profile photo" onPress={choose}>
          <View
            style={{
              width: 196,
              height: 196,
              borderRadius: 98,
              backgroundColor: c.onAccent,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            {uploading ? <ActivityIndicator color={c.accent} /> : <Avatar profile={profile} size={184} />}
          </View>
          <View
            style={{
              position: 'absolute',
              right: 8,
              bottom: 8,
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: c.accentDeep,
              borderWidth: 4,
              borderColor: c.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name={hasPhoto ? 'camera' : 'add'} size={22} color={c.onAccent} />
          </View>
        </Pressable>
      </FadeUp>
    </OnboardingShell>
  );
}

/** Step 3: car or motorbike. */
export function RideStep({onNext, onBack}: StepProps) {
  const rideType = useOnboardingStore((s) => s.rideType);
  const setRideType = useOnboardingStore((s) => s.setRideType);
  const handle = useProfileStore((s) => s.profile?.handle);
  return (
    <OnboardingShell
      step={3}
      onBack={onBack}
      title={handle ? `What do you ride, @${handle}?` : 'What do you ride?'}
      subtitle="Car or motorbike: DriveSense works for both."
      footer={<PillButton label="Next" onPress={onNext} />}>
      <FadeUp index={2}>
        <ChoiceCard title="Car" selected={rideType === 'car'} onPress={() => setRideType('car')} icon={(color) => <VehicleIcon type="car" size={34} color={color} />} />
      </FadeUp>
      <FadeUp index={3}>
        <ChoiceCard
          title="Motorbike"
          selected={rideType === 'motorbike'}
          onPress={() => setRideType('motorbike')}
          icon={(color) => <VehicleIcon type="motorbike" size={34} color={color} />}
        />
      </FadeUp>
    </OnboardingShell>
  );
}

const FUELS: {value: FuelType; label: string}[] = [
  {value: 'petrol', label: 'Petrol'},
  {value: 'diesel', label: 'Diesel'},
  {value: 'electric', label: 'Electric'},
  {value: 'hybrid', label: 'Hybrid'},
  {value: 'cng', label: 'CNG'},
];

const THIS_YEAR = new Date().getFullYear();
const yearOk = (year: string) => /^\d{4}$/.test(year) && Number(year) >= 1950 && Number(year) <= THIS_YEAR + 1;

/** Step 4: the first vehicle, make and model picked from the catalogue as you type. */
export function VehicleStep({onNext, onBack}: StepProps) {
  const c = useAppTheme().colors;
  const rideType = useOnboardingStore((s) => s.rideType);
  const vehicleId = useOnboardingStore((s) => s.vehicleId);
  const setVehicleId = useOnboardingStore((s) => s.setVehicleId);
  const vehicles = useVehicleStore((s) => s.vehicles);
  const create = useVehicleStore((s) => s.create);
  const update = useVehicleStore((s) => s.update);
  const existing = vehicles.find((v) => v.id === vehicleId);
  const [make, setMake] = useState(existing?.company_name ?? '');
  const [model, setModel] = useState(existing?.model_name ?? '');
  const [year, setYear] = useState(existing?.year ? String(existing.year) : '');
  const [hp, setHp] = useState(existing?.horsepower ? String(existing.horsepower) : '');
  const [fuel, setFuel] = useState<FuelType>(existing?.fuel_type ?? 'petrol');
  const [saving, setSaving] = useState(false);
  // Coming back to a vehicle already entered shows every line at once, without grabbing focus.
  const [resumed] = useState(existing != null);
  /** The next line slides the ones below it down softly instead of jumping. */
  const reveal = () => LayoutAnimation.configureNext(LayoutAnimation.create(260, 'easeInEaseOut', 'opacity'));
  const fuels = rideType === 'motorbike' ? FUELS.filter((f) => f.value === 'petrol' || f.value === 'electric') : FUELS;
  const ready = !!make && !!model && yearOk(year) && (!hp || /^\d{1,4}$/.test(hp));

  const save = async () => {
    const input: VehicleInput = {
      vehicle_type: rideType,
      nickname: null,
      make,
      model,
      year: Number(year),
      horsepower: hp ? Number(hp) : null,
      fuel_type: fuel,
    };
    setSaving(true);
    try {
      if (vehicleId && existing) {
        await update(vehicleId, input);
      } else {
        setVehicleId((await create(input)).id);
      }
      onNext();
    } catch (e) {
      failed('Vehicle', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingShell
      step={4}
      onBack={onBack}
      title={rideType === 'motorbike' ? 'Your motorbike' : 'Your car'}
      subtitle="Drives are logged against it. You can add more in the Garage."
      hideFooterWhileTyping
      footer={<PillButton label="Continue" onPress={save} disabled={!ready} busy={saving} />}>
      <FadeUp index={2}>
        <LinePicker
          value={make}
          options={makesFor(rideType)}
          onChange={(value) => {
            reveal();
            setMake(value);
            setModel('');
          }}
          placeholder="make"
        />
      </FadeUp>
      {/* One line at a time: each appears (and takes the keyboard) once the one above is filled. */}
      {make ? (
        <FadeUp>
          {/* Keyed by make, so picking another make clears what was typed for the old one. */}
          <LinePicker
            key={make}
            value={model}
            options={modelsFor(rideType, make)}
            onChange={(value) => {
              reveal();
              setModel(value);
            }}
            placeholder="model"
            autoFocus={!resumed && !model}
          />
        </FadeUp>
      ) : null}
      {model ? (
        <FadeUp>
          <LineField
            value={year}
            onChangeText={(v) => {
              const next = v.replace(/\D/g, '');
              if (yearOk(next) !== yearOk(year)) {
                reveal();
              }
              setYear(next);
              // A full year is done: drop the keyboard so the rest of the form shows.
              if (yearOk(next)) {
                Keyboard.dismiss();
              }
            }}
            placeholder="year"
            valid={yearOk(year)}
            keyboardType="number-pad"
            maxLength={4}
            autoFocus={!resumed && !year}
          />
        </FadeUp>
      ) : null}
      {yearOk(year) ? (
        <FadeUp>
          <LineField value={hp} onChangeText={(v) => setHp(v.replace(/\D/g, ''))} placeholder="horsepower (optional)" valid={!!hp} keyboardType="number-pad" maxLength={4} />
        </FadeUp>
      ) : null}
      {yearOk(year) ? (
        <FadeUp index={1} style={{gap: 12, marginTop: 6}}>
          <AppText size={15} weight="extrabold" color={withAlpha(c.onAccent, 0.85)}>
            Fuel
          </AppText>
          <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10}}>
            {fuels.map((f) => {
              const on = f.value === fuel;
              return (
                <Pressable
                  key={f.value}
                  accessibilityRole="radio"
                  accessibilityState={{selected: on}}
                  accessibilityLabel={f.label}
                  onPress={() => {
                    void Haptics.selectionAsync().catch(() => undefined);
                    setFuel(f.value);
                  }}
                  style={{
                    paddingHorizontal: 20,
                    height: 44,
                    borderRadius: 22,
                    justifyContent: 'center',
                    backgroundColor: on ? c.onAccent : withAlpha(c.onAccent, 0.16),
                  }}>
                  <AppText size={16} weight="black" color={on ? c.accentDeep : c.onAccent}>
                    {f.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </FadeUp>
      ) : null}
    </OnboardingShell>
  );
}

const FREQUENCIES: {
  value: DrivingFrequency;
  title: string;
  subtitle: string;
}[] = [
  {
    value: 'daily',
    title: 'Every day',
    subtitle: 'Daily driver. Goal: 7 drives a week.',
  },
  {
    value: 'most',
    title: 'Most days',
    subtitle: 'A few times a week. Goal: 4.',
  },
  {
    value: 'weekends',
    title: 'Weekends',
    subtitle: 'Mostly on days off. Goal: 2.',
  },
  {value: 'rarely', title: 'Rarely', subtitle: 'Once in a while. Goal: 1.'},
];

/**
 * Step 5: how often they drive. It sets the weekly drive goal, whether streaks count days or weeks,
 * and a couple of defaults (auto-start, power mode).
 */
export function FrequencyStep({onNext, onBack}: StepProps) {
  const handle = useProfileStore((s) => s.profile?.handle);
  const saved = useProfileStore((s) => s.profile?.driving_frequency ?? null);
  const updateProfile = useProfileStore((s) => s.update);
  const setPreferences = usePreferencesStore((s) => s.set);
  const [choice, setChoice] = useState<DrivingFrequency | null>(saved);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!choice) {
      return;
    }
    setSaving(true);
    try {
      await updateProfile({driving_frequency: choice});
      await setPreferences(frequencyDefaults(choice));
      onNext();
    } catch (e) {
      failed('Driving rhythm', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingShell
      step={5}
      onBack={onBack}
      title={handle ? `How often do you drive, @${handle}?` : 'How often do you drive?'}
      subtitle="This sets your weekly goal and how your streak counts."
      footer={<PillButton label="Continue" onPress={save} disabled={!choice} busy={saving} />}>
      {FREQUENCIES.map((f, i) => (
        <FadeUp key={f.value} index={2 + i}>
          <ChoiceCard title={f.title} subtitle={f.subtitle} selected={choice === f.value} onPress={() => setChoice(f.value)} />
        </FadeUp>
      ))}
    </OnboardingShell>
  );
}
