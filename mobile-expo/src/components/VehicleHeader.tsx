import React from 'react';
import {View, Text, Image, Pressable} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useAppTheme} from '../theme/appTheme';

interface VehicleHeaderProps {
  vehicleName: string;
  vehicleImage?: string;
  isActive?: boolean;
  onPress?: () => void;
}

const CarPlaceholder = ({isDark}: {isDark: boolean}) => (
  <View
    className="h-9 w-9 items-center justify-center rounded-[10px]"
    style={{
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
    }}>
    <Ionicons name="car" size={20} color={isDark ? '#D1D5DB' : '#6B7280'} />
  </View>
);

export const VehicleHeader: React.FC<VehicleHeaderProps> = ({
  vehicleName,
  vehicleImage,
  isActive = true,
  onPress,
}) => {
  const theme = useAppTheme();

  return (
    <Pressable
      className="flex-row items-center py-1"
      onPress={onPress}
      style={{opacity: 1}}>
      <View className="relative mr-2.5">
        {vehicleImage ? (
          <Image
            source={{uri: vehicleImage}}
            className="h-9 w-9 rounded-[10px]"
            style={{backgroundColor: theme.card}}
            resizeMode="cover"
          />
        ) : (
          <CarPlaceholder isDark={theme.dark} />
        )}
        {isActive && (
          <View
            className="absolute bottom-0 right-0 h-2 w-2 rounded-full border-2"
            style={{
              backgroundColor: theme.success,
              borderColor: theme.screen,
              transform: [{translateY: 1}],
            }}
          />
        )}
      </View>

      <View className="flex-1">
        <Text style={{color: theme.text, ...theme.typography.sectionTitle}}>{vehicleName}</Text>
        <View className="mt-[3px] flex-row items-center">
          <View
            className="flex-row items-center rounded-full px-2 py-[3px]"
            style={{
              backgroundColor: isActive ? theme.accentMuted : theme.chip,
            }}>
            <View
              className="mr-1.5 h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: isActive ? theme.success : theme.textSubtle,
              }}
            />
            <Text style={{...theme.typography.caption, color: isActive ? theme.accent : theme.textSubtle}}>
              {isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
      </View>

      <View className="p-1">
        <Ionicons name="chevron-forward" size={18} color={theme.textSubtle} />
      </View>
    </Pressable>
  );
};
