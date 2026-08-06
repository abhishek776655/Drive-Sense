import React, {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {AddVehicleScreenProps} from '../navigation/types';
import {useAppTheme} from '../theme/appTheme';
import {getApiErrorMessage} from '../services/apiClient';
import {vehicleService, type VehicleFuelType} from '../services/vehicleService';
import {vehicleCatalogService, type VehicleCatalogCompany} from '../services/vehicleCatalogService';
import {useDashboardStore} from '../store/dashboardStore';

const FUEL_TYPES: VehicleFuelType[] = ['petrol', 'diesel', 'cng', 'lpg', 'electric', 'hybrid', 'other'];

export const AddVehicleScreen: React.FC<AddVehicleScreenProps> = ({navigation, route}) => {
  const theme = useAppTheme();
  const dashboard = useDashboardStore((state) => state.data);
  const fetchDashboard = useDashboardStore((state) => state.fetchDashboard);
  const vehicleId = route.params?.vehicleId;

  const [catalog, setCatalog] = useState<VehicleCatalogCompany[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  const [nickname, setNickname] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [fuelType, setFuelType] = useState<VehicleFuelType>('petrol');
  const [tankCapacity, setTankCapacity] = useState('');
  const [mileageBaseline, setMileageBaseline] = useState('');
  const [saving, setSaving] = useState(false);

  const editingVehicle = dashboard?.vehicles.find((item) => item.id === vehicleId);

  useEffect(() => {
    let cancelled = false;
    const loadCatalog = async () => {
      try {
        setCatalogLoading(true);
        setCatalogError(null);
        const companies = await vehicleCatalogService.fetchCatalog();
        if (!cancelled) {
          setCatalog(companies);
        }
      } catch (error) {
        if (!cancelled) {
          setCatalogError(getApiErrorMessage(error));
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

  useEffect(() => {
    if (!editingVehicle || catalog.length === 0) {
      return;
    }
    const company = catalog.find((item) => item.name === editingVehicle.companyName);
    if (company) {
      setCompanyId(company.id);
      const model = company.models.find((item) => item.name === editingVehicle.modelName);
      if (model) {
        setModelId(model.id);
      }
    }
    setNickname(editingVehicle.nickname ?? '');
    setPlateNumber(editingVehicle.plateNumber ?? '');
    setFuelType((editingVehicle.fuelType as VehicleFuelType) ?? 'petrol');
    setMileageBaseline(
      editingVehicle.mileageBaselineKmPerL != null ? String(editingVehicle.mileageBaselineKmPerL) : '',
    );
  }, [editingVehicle, catalog]);

  const isElectric = fuelType === 'electric';
  const selectedCompany = catalog.find((item) => item.id === companyId) ?? null;
  const selectedModel = selectedCompany?.models.find((item) => item.id === modelId) ?? null;
  const canSubmit = useMemo(() => Boolean(modelId), [modelId]);

  const handleSubmit = async () => {
    if (!canSubmit || saving || !modelId) {
      return;
    }

    try {
      setSaving(true);
      const payload = {
        model_id: modelId,
        nickname: nickname.trim() || null,
        plate_number: plateNumber.trim() || null,
        fuel_type: fuelType,
        tank_capacity_liters: tankCapacity.trim() ? Number.parseFloat(tankCapacity) : null,
        mileage_baseline_km_per_l:
          !isElectric && mileageBaseline.trim() ? Number.parseFloat(mileageBaseline) : null,
      };
      if (editingVehicle) {
        await vehicleService.updateVehicle(editingVehicle.id, payload);
      } else {
        await vehicleService.createVehicle(payload);
      }
      await fetchDashboard();
      navigation.goBack();
    } catch (error) {
      Alert.alert(editingVehicle ? 'Unable to update vehicle' : 'Unable to add vehicle', getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{backgroundColor: theme.screen}}>
      <ScrollView contentContainerStyle={{paddingBottom: 168}} className="px-5 pt-3" showsVerticalScrollIndicator={false}>
        <View className="mb-6 flex-row items-center justify-between">
          <Pressable
            className="size-10 items-center justify-center rounded-[14px] border"
            style={{
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            }}
            onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={18} color={theme.text} />
          </Pressable>
          <Text style={{color: theme.text, fontSize: 22, fontWeight: '800'}}>{editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}</Text>
          <View className="size-10" />
        </View>

        <View className="mb-5 items-center">
          <View
            className="size-24 items-center justify-center rounded-full border"
            style={{
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            }}>
            <Ionicons name="car-sport" size={38} color={theme.accent} />
          </View>
          <Text className="mt-3.5" style={{color: theme.text, ...theme.typography.sectionTitle, fontSize: 18}}>
            {editingVehicle ? 'Update your vehicle details' : 'Add a vehicle to your garage'}
          </Text>
          <Text className="mt-1 text-center" style={{color: theme.textSubtle, ...theme.typography.body}}>
            {editingVehicle
              ? 'Refresh the basics that show up across tracking, trips, and your garage.'
              : 'Pick your vehicle from the list below to get started.'}
          </Text>
        </View>

        {catalogError ? (
          <View
            className="mb-[14px] rounded-[22px] border p-4"
            style={{backgroundColor: theme.card, borderColor: theme.cardBorder}}>
            <Text style={{color: theme.danger, ...theme.typography.body}}>{catalogError}</Text>
          </View>
        ) : null}

        <View
          className="mb-[14px] rounded-[22px] border p-4"
          style={{
            backgroundColor: theme.card,
            borderColor: theme.cardBorder,
          }}>
          <Text className="mb-2.5" style={{color: theme.text, ...theme.typography.sectionTitle}}>Company</Text>
          {catalogLoading ? (
            <ActivityIndicator color={theme.accent} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row">
                {catalog.map((company) => {
                  const active = company.id === companyId;
                  return (
                    <Pressable
                      key={company.id}
                      onPress={() => {
                        setCompanyId(company.id);
                        setModelId(null);
                        setModelDropdownOpen(false);
                      }}
                      className="mr-2.5 rounded-[14px] px-4 py-2.5"
                      style={{backgroundColor: active ? theme.accentMuted : theme.chip}}>
                      <Text style={{color: active ? theme.accent : theme.textSubtle, fontSize: 13, fontWeight: '700'}}>
                        {company.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>

        {selectedCompany ? (
          <View
            className="mb-[14px] rounded-[22px] border p-4"
            style={{
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            }}>
            <Text className="mb-2.5" style={{color: theme.text, ...theme.typography.sectionTitle}}>Model</Text>
            <Pressable
              onPress={() => setModelDropdownOpen((open) => !open)}
              className="flex-row items-center justify-between rounded-[14px] border px-4 py-3.5"
              style={{backgroundColor: theme.cardSoft, borderColor: theme.cardBorder}}>
              <Text style={{color: selectedModel ? theme.text : theme.textSubtle, fontSize: 15, fontWeight: selectedModel ? '700' : '400'}}>
                {selectedModel?.name ?? 'Select a model'}
              </Text>
              <Ionicons name={modelDropdownOpen ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSubtle} />
            </Pressable>
            {modelDropdownOpen ? (
              <View
                className="mt-2 overflow-hidden rounded-[14px] border"
                style={{borderColor: theme.cardBorder}}>
                {selectedCompany.models.map((model, index) => {
                  const active = model.id === modelId;
                  return (
                    <Pressable
                      key={model.id}
                      onPress={() => {
                        setModelId(model.id);
                        setModelDropdownOpen(false);
                      }}
                      className="flex-row items-center justify-between px-4 py-3"
                      style={{
                        backgroundColor: active ? theme.accentMuted : theme.cardSoft,
                        borderTopWidth: index === 0 ? 0 : 1,
                        borderTopColor: theme.cardBorder,
                      }}>
                      <Text style={{color: active ? theme.accent : theme.text, fontSize: 14, fontWeight: active ? '700' : '400'}}>
                        {model.name}
                      </Text>
                      {active ? <Ionicons name="checkmark" size={18} color={theme.accent} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : null}

        <View
          className="mb-[14px] rounded-[22px] border p-4"
          style={{
            backgroundColor: theme.card,
            borderColor: theme.cardBorder,
          }}>
          <Text className="mb-2" style={{color: theme.textSubtle, ...theme.typography.caption}}>Nickname (optional)</Text>
          <TextInput
            value={nickname}
            onChangeText={setNickname}
            placeholder="e.g. My Daily Driver"
            placeholderTextColor={theme.textSubtle}
            className="py-0"
            style={{color: theme.text, fontSize: 15}}
          />
        </View>

        <View
          className="mb-[14px] rounded-[22px] border p-4"
          style={{
            backgroundColor: theme.card,
            borderColor: theme.cardBorder,
          }}>
          <Text className="mb-2" style={{color: theme.textSubtle, ...theme.typography.caption}}>Plate number</Text>
          <TextInput
            value={plateNumber}
            onChangeText={setPlateNumber}
            autoCapitalize="characters"
            placeholder="e.g. DL 10 AB 1234"
            placeholderTextColor={theme.textSubtle}
            className="py-0"
            style={{color: theme.text, fontSize: 15}}
          />
        </View>

        <View
          className="mb-[14px] rounded-[22px] border p-4"
          style={{
            backgroundColor: theme.card,
            borderColor: theme.cardBorder,
          }}>
          <Text className="mb-2.5" style={{color: theme.text, ...theme.typography.sectionTitle}}>Fuel type</Text>
          <View className="flex-row flex-wrap justify-between">
            {FUEL_TYPES.map((item) => {
              const active = item === fuelType;
              return (
                <Pressable
                  key={item}
                  onPress={() => setFuelType(item)}
                  className="mb-2.5 w-[31.5%] items-center rounded-[14px] py-3"
                  style={{backgroundColor: active ? theme.accentMuted : theme.chip}}>
                  <Text style={{color: active ? theme.accent : theme.textSubtle, fontSize: 12, fontWeight: '700'}}>
                    {item.charAt(0).toUpperCase() + item.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View
          className="mb-[14px] rounded-[22px] border p-4"
          style={{
            backgroundColor: theme.card,
            borderColor: theme.cardBorder,
          }}>
          <Text className="mb-2" style={{color: theme.textSubtle, ...theme.typography.caption}}>Tank capacity (optional)</Text>
          <TextInput
            value={tankCapacity}
            onChangeText={setTankCapacity}
            keyboardType="decimal-pad"
            placeholder={isElectric ? 'Skip for EVs' : 'e.g. 42'}
            placeholderTextColor={theme.textSubtle}
            className="py-0"
            style={{color: theme.text, fontSize: 15}}
          />
        </View>

        <View
          className="mb-5 rounded-[22px] border p-4"
          style={{
            backgroundColor: theme.card,
            borderColor: theme.cardBorder,
          }}>
          <Text className="mb-2" style={{color: theme.textSubtle, ...theme.typography.caption}}>
            Mileage baseline {isElectric ? '(not required for EVs)' : '(optional)'}
          </Text>
          <TextInput
            value={mileageBaseline}
            onChangeText={setMileageBaseline}
            keyboardType="decimal-pad"
            editable={!isElectric}
            placeholder={isElectric ? 'Not applicable' : 'e.g. 16.5'}
            placeholderTextColor={theme.textSubtle}
            className="py-0"
            style={{color: isElectric ? theme.textSubtle : theme.text, fontSize: 15}}
          />
        </View>

        <Pressable
          onPress={() => void handleSubmit()}
          disabled={!canSubmit || saving}
          className="mb-3 mt-1 flex-row items-center justify-center rounded-2xl py-4"
          style={{
            backgroundColor: !canSubmit || saving ? theme.chip : theme.accent,
          }}>
          {saving ? <ActivityIndicator color={theme.onAccent} /> : null}
          <Text className={saving ? 'ml-2' : ''} style={{color: !canSubmit || saving ? theme.textSubtle : '#ffffff', fontSize: 16, fontWeight: '800'}}>
            {saving ? (editingVehicle ? 'Saving Changes' : 'Saving Vehicle') : editingVehicle ? 'Save Changes' : 'Add Vehicle'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};
