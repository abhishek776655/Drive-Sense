import React, {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {AddVehicleScreenProps} from '../navigation/types';
import {useAppTheme} from '../theme/appTheme';
import {getApiErrorMessage} from '../services/apiClient';
import {vehicleService, type VehicleFuelType} from '../services/vehicleService';
import {useDashboardStore} from '../store/dashboardStore';

const FUEL_TYPES: VehicleFuelType[] = ['petrol', 'diesel', 'cng', 'lpg', 'electric', 'hybrid', 'other'];

export const AddVehicleScreen: React.FC<AddVehicleScreenProps> = ({navigation, route}) => {
  const theme = useAppTheme();
  const dashboard = useDashboardStore((state) => state.data);
  const fetchDashboard = useDashboardStore((state) => state.fetchDashboard);
  const vehicleId = route.params?.vehicleId;
  const [name, setName] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [fuelType, setFuelType] = useState<VehicleFuelType>('petrol');
  const [tankCapacity, setTankCapacity] = useState('');
  const [mileageBaseline, setMileageBaseline] = useState('');
  const [saving, setSaving] = useState(false);

  const editingVehicle = dashboard?.vehicles.find((item) => item.id === vehicleId);

  useEffect(() => {
    if (!editingVehicle) {
      return;
    }
    setName(editingVehicle.name);
    setPlateNumber(editingVehicle.plateNumber ?? '');
    setFuelType((editingVehicle.fuelType as VehicleFuelType) ?? 'petrol');
    setMileageBaseline(
      editingVehicle.mileageBaselineKmPerL != null ? String(editingVehicle.mileageBaselineKmPerL) : '',
    );
  }, [editingVehicle]);

  const isElectric = fuelType === 'electric';
  const canSubmit = useMemo(() => name.trim().length > 0, [name]);

  const handleSubmit = async () => {
    if (!canSubmit || saving) {
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: name.trim(),
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
              : 'This vehicle will be available for live tracking, trips, and dashboard summaries.'}
          </Text>
        </View>

        <View
          className="mb-[14px] rounded-[22px] border p-4"
          style={{
            backgroundColor: theme.card,
            borderColor: theme.cardBorder,
          }}>
          <Text className="mb-2" style={{color: theme.textSubtle, ...theme.typography.caption}}>Vehicle name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Honda City"
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
