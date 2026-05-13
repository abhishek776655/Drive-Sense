import React from 'react';
import {View, Text, Pressable} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useAppTheme} from '../theme/appTheme';

interface Vehicle {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
}

interface VehicleSelectorProps {
  visible: boolean;
  vehicles: Vehicle[];
  selectedId: string;
  onSelect: (vehicleId: string) => void;
  onClose: () => void;
}

export const VehicleSelector: React.FC<VehicleSelectorProps> = ({
  visible,
  vehicles,
  selectedId,
  onSelect,
  onClose,
}) => {
  const theme = useAppTheme();
  if (!visible) return null;
  const palette = {
    overlay: 'rgba(0,0,0,0.45)',
    sheet: theme.card,
    text: theme.text,
    textSecondary: theme.textSubtle,
    card: theme.cardSoft,
    selected: theme.accentMuted,
    selectedBorder: 'rgba(36,107,255,0.35)',
    accent: theme.accent,
    accentSoft: theme.accentMuted,
    border: theme.cardBorder,
  };

  return (
    <Pressable
      className="absolute inset-0"
      style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: palette.overlay}}
      onPress={onClose}>
      <Pressable
        className="absolute inset-x-0 bottom-0 rounded-t-[28px] p-5"
        style={{
          backgroundColor: palette.sheet,
        }}
        onPress={(e) => e.stopPropagation()}>
        <View className="mb-[18px] flex-row items-center justify-between">
          <Text style={{color: palette.text, ...theme.typography.sectionTitle, fontSize: 18}}>Select Vehicle</Text>
          <Pressable onPress={onClose} className="p-2">
            <Ionicons name="close" size={20} color={palette.textSecondary} />
          </Pressable>
        </View>

        {vehicles.map((vehicle) => (
          <Pressable
            key={vehicle.id}
            className="mb-2.5 flex-row items-center rounded-[18px] border p-[14px]"
            style={{
              backgroundColor: selectedId === vehicle.id ? palette.selected : palette.card,
              borderColor: selectedId === vehicle.id ? palette.selectedBorder : palette.border,
            }}
            onPress={() => {
              onSelect(vehicle.id);
              onClose();
            }}>
            <View
              className="mr-3 size-10 items-center justify-center rounded-[14px]"
              style={{
                backgroundColor: palette.accentSoft,
              }}>
              <Ionicons name="car" size={20} color={palette.accent} />
            </View>
            <View className="flex-1">
              <Text style={{color: palette.text, ...theme.typography.body}}>{vehicle.name}</Text>
              <Text className="mt-0.5" style={{color: palette.textSecondary, ...theme.typography.caption}}>{vehicle.type}</Text>
            </View>
            {vehicle.isActive && (
              <View className="flex-row items-center">
                <View className="mr-1.5 size-2 rounded-full" style={{backgroundColor: '#22C55E'}} />
                <Text style={{color: palette.accent, ...theme.typography.caption}}>Active</Text>
              </View>
            )}
            {selectedId === vehicle.id && (
              <Ionicons name="checkmark-circle" size={22} color={palette.accent} />
            )}
          </Pressable>
        ))}

        <Pressable
          className="mt-1 flex-row items-center justify-center rounded-[18px] border border-dashed p-[14px]"
          style={{
            borderColor: palette.border,
          }}>
          <Ionicons name="add-circle-outline" size={20} color={palette.accent} />
          <Text className="ml-2" style={{color: palette.accent, ...theme.typography.body}}>Add New Vehicle</Text>
        </Pressable>
      </Pressable>
    </Pressable>
  );
};
