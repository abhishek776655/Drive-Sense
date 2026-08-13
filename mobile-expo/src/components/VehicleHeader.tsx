import React from 'react';
import {View, Text, Image, Pressable} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {vehicleImageSource} from '../utils/vehicleImage';
import {useAppTheme} from '../theme/appTheme';

interface VehicleHeaderProps {
  vehicleName: string;
  vehicleImage?: string;
  isSelected?: boolean;
  onPress?: () => void;
}

export const VehicleHeader: React.FC<VehicleHeaderProps> = ({
  vehicleName,
  vehicleImage,
  isSelected = true,
  onPress,
}) => {
  const theme = useAppTheme();

  return (
    <Pressable
      className="flex-row items-center py-1"
      onPress={onPress}
      style={{opacity: 1}}>
      <View className="relative mr-2.5">
        <Image
          source={vehicleImageSource(vehicleImage)}
          className="h-10 w-10 rounded-[12px]"
          style={{backgroundColor: theme.cardSoft}}
          resizeMode="contain"
        />
        {isSelected && (
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
      </View>

      <View className="p-1">
        <Ionicons name="chevron-forward" size={18} color={theme.textSubtle} />
      </View>
    </Pressable>
  );
};
