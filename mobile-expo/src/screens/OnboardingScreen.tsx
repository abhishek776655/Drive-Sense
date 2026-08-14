import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {useAppTheme} from '../theme/appTheme';
import {useCardStyle} from '../components/Card';
import {AuthTextField} from '../components/AuthTextField';
import {AuthErrorBanner, AuthPrimaryButton} from '../components/AuthChrome';
import {SkeletonBlock} from '../components/SkeletonBlock';
import {getApiErrorMessage} from '../services/apiClient';
import {vehicleCatalogService, type VehicleCatalogCompany} from '../services/vehicleCatalogService';
import {vehicleService, type VehicleFuelType} from '../services/vehicleService';
import {vehicleImageSource} from '../utils/vehicleImage';

interface OnboardingScreenProps {
  /** Called once a vehicle exists, or when the user chooses to do it later. */
  onDone: () => void;
}

const FUEL_TYPES: VehicleFuelType[] = ['petrol', 'diesel', 'cng', 'lpg', 'electric', 'hybrid', 'other'];

type Step = 'company' | 'model' | 'details';

const STEP_ORDER: Step[] = ['company', 'model', 'details'];

const STEP_COPY: Record<Step, {title: string; subtitle: string}> = {
  company: {title: 'Pick your make', subtitle: 'Which brand is your vehicle?'},
  model: {title: 'Pick your model', subtitle: 'We use this for mileage and photos.'},
  details: {title: 'Add the details', subtitle: 'Only the fuel type is required.'},
};

/** Progress dots. Three steps is few enough to show as dots rather than a labelled stepper. */
const StepDots: React.FC<{step: Step}> = ({step}) => {
  const theme = useAppTheme();
  const activeIndex = STEP_ORDER.indexOf(step);

  return (
    <View style={{flexDirection: 'row', alignItems: 'center'}}>
      {STEP_ORDER.map((entry, index) => (
        <View
          key={entry}
          style={{
            height: 6,
            width: index === activeIndex ? 22 : 6,
            borderRadius: 3,
            marginRight: index === STEP_ORDER.length - 1 ? 0 : 6,
            backgroundColor: index <= activeIndex ? theme.accent : theme.cardBorder,
          }}
        />
      ))}
    </View>
  );
};

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({onDone}) => {
  const theme = useAppTheme();
  const cardStyle = useCardStyle();
  const [catalog, setCatalog] = useState<VehicleCatalogCompany[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [step, setStep] = useState<Step>('company');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [fuelType, setFuelType] = useState<VehicleFuelType>('petrol');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadCatalog = async () => {
      try {
        const companies = await vehicleCatalogService.fetchCatalog();
        if (!cancelled) {
          setCatalog(companies);
          setCatalogError('');
        }
      } catch (error) {
        if (!cancelled) {
          setCatalogError(getApiErrorMessage(error, 'Could not load the vehicle catalog.'));
        }
      } finally {
        if (!cancelled) {
          setCatalogLoading(false);
        }
      }
    };

    void loadCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  const company = useMemo(() => catalog.find((item) => item.id === companyId) ?? null, [catalog, companyId]);
  const model = useMemo(() => company?.models.find((item) => item.id === modelId) ?? null, [company, modelId]);

  const goBack = () => {
    if (step === 'details') {
      setStep('model');
      return;
    }
    if (step === 'model') {
      setStep('company');
      setModelId(null);
    }
  };

  const handleCreate = async () => {
    if (!modelId) {
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      await vehicleService.createVehicle({
        model_id: modelId,
        nickname: nickname.trim() || null,
        plate_number: plateNumber.trim() || null,
        fuel_type: fuelType,
      });
      onDone();
    } catch (error) {
      setSaveError(getApiErrorMessage(error, 'Could not add your vehicle. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const renderCompanyStep = () => (
    <View style={{flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between'}}>
      {catalog.map((item) => {
        const active = item.id === companyId;
        return (
          <Pressable
            key={item.id}
            onPress={() => {
              setCompanyId(item.id);
              setModelId(null);
              setStep('model');
            }}
            accessibilityRole="button"
            accessibilityState={{selected: active}}
            style={[
              cardStyle,
              {
                width: '48.5%',
                marginBottom: 10,
                padding: 14,
                minHeight: 64,
                justifyContent: 'center',
                borderColor: active ? theme.accent : theme.cardBorder,
              },
            ]}>
            <Text numberOfLines={2} style={{color: theme.text, ...theme.typography.body, fontWeight: '700'}}>
              {item.name}
            </Text>
            <Text style={{color: theme.textSubtle, ...theme.typography.caption, marginTop: 2}}>
              {item.models.length} {item.models.length === 1 ? 'model' : 'models'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderModelStep = () => (
    <View>
      {(company?.models ?? []).map((item) => {
        const active = item.id === modelId;
        return (
          <Pressable
            key={item.id}
            onPress={() => {
              setModelId(item.id);
              setStep('details');
            }}
            accessibilityRole="button"
            accessibilityState={{selected: active}}
            style={[
              cardStyle,
              {
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 10,
                padding: 12,
                borderColor: active ? theme.accent : theme.cardBorder,
              },
            ]}>
            <View
              style={{
                height: 44,
                width: 62,
                borderRadius: 12,
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.accentMuted,
                marginRight: 12,
              }}>
              <Image
                source={vehicleImageSource(item.image_url)}
                resizeMode="contain"
                style={{height: '100%', width: '100%'}}
                accessibilityIgnoresInvertColors
              />
            </View>
            <Text style={{flex: 1, color: theme.text, ...theme.typography.body, fontWeight: '700'}}>{item.name}</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textSubtle} />
          </Pressable>
        );
      })}
    </View>
  );

  const renderDetailsStep = () => (
    <View>
      <View style={[cardStyle, {flexDirection: 'row', alignItems: 'center', marginBottom: 16}]}>
        <View
          style={{
            height: 46,
            width: 66,
            borderRadius: 12,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.accentMuted,
            marginRight: 12,
          }}>
          <Image
            source={vehicleImageSource(model?.image_url)}
            resizeMode="contain"
            style={{height: '100%', width: '100%'}}
            accessibilityIgnoresInvertColors
          />
        </View>
        <View style={{flex: 1}}>
          <Text style={{color: theme.text, ...theme.typography.body, fontWeight: '800'}}>
            {company?.name} {model?.name}
          </Text>
          <Pressable onPress={() => setStep('company')} hitSlop={8} accessibilityRole="button">
            <Text style={{color: theme.accent, ...theme.typography.caption, fontWeight: '700', marginTop: 2}}>
              Change
            </Text>
          </Pressable>
        </View>
      </View>

      <AuthTextField
        icon="pricetag-outline"
        placeholder="Nickname (optional)"
        value={nickname}
        onChangeText={setNickname}
        autoCapitalize="words"
      />
      <AuthTextField
        icon="car-outline"
        placeholder="Plate number (optional)"
        value={plateNumber}
        onChangeText={setPlateNumber}
        autoCapitalize="characters"
        autoCorrect={false}
        marginBottom={16}
      />

      <Text style={{color: theme.textSubtle, ...theme.typography.caption, marginBottom: 8, marginLeft: 4}}>
        Fuel type
      </Text>
      <View style={{flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20}}>
        {FUEL_TYPES.map((item) => {
          const active = item === fuelType;
          return (
            <Pressable
              key={item}
              onPress={() => setFuelType(item)}
              accessibilityRole="button"
              accessibilityState={{selected: active}}
              style={{
                borderRadius: 999,
                paddingHorizontal: 14,
                minHeight: 38,
                justifyContent: 'center',
                marginRight: 8,
                marginBottom: 8,
                borderWidth: 1,
                backgroundColor: active ? theme.accentMuted : theme.card,
                borderColor: active ? theme.accent : theme.cardBorder,
              }}>
              <Text
                style={{
                  color: active ? theme.accent : theme.textSubtle,
                  ...theme.typography.caption,
                  fontWeight: '700',
                  textTransform: 'capitalize',
                }}>
                {item}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {saveError ? <AuthErrorBanner message={saveError} /> : null}

      <AuthPrimaryButton label="Add Vehicle" onPress={() => void handleCreate()} loading={saving} />
    </View>
  );

  const renderBody = () => {
    if (catalogLoading) {
      return (
        <View>
          <SkeletonBlock height={64} radius={22} style={{marginBottom: 10}} />
          <SkeletonBlock height={64} radius={22} style={{marginBottom: 10}} />
          <SkeletonBlock height={64} radius={22} style={{marginBottom: 10}} />
          <SkeletonBlock height={64} radius={22} />
        </View>
      );
    }

    if (catalogError) {
      return <AuthErrorBanner message={catalogError} />;
    }

    if (step === 'company') {
      return renderCompanyStep();
    }
    if (step === 'model') {
      return renderModelStep();
    }
    return renderDetailsStep();
  };

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: theme.screen}}>
      <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{flex: 1, paddingHorizontal: 20, paddingTop: 12}}>
          <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18}}>
            {step === 'company' ? (
              <View style={{height: 40, width: 40}} />
            ) : (
              <Pressable
                onPress={goBack}
                accessibilityRole="button"
                accessibilityLabel="Back"
                style={[cardStyle, {height: 40, width: 40, padding: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 14}]}>
                <Ionicons name="chevron-back" size={18} color={theme.text} />
              </Pressable>
            )}
            <StepDots step={step} />
            {/* Skipping is allowed: the app still works with no vehicle, and forcing setup before
                someone can look around is a good way to lose them at the door. */}
            <Pressable onPress={onDone} hitSlop={10} accessibilityRole="button" accessibilityLabel="Skip for now">
              <Text style={{color: theme.textSubtle, ...theme.typography.caption, fontWeight: '700'}}>Skip</Text>
            </Pressable>
          </View>

          <Text style={{color: theme.text, ...theme.typography.pageTitle}}>{STEP_COPY[step].title}</Text>
          <Text style={{color: theme.textSubtle, ...theme.typography.body, marginTop: 6, marginBottom: 18}}>
            {STEP_COPY[step].subtitle}
          </Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{paddingBottom: 40}}>
            {renderBody()}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
