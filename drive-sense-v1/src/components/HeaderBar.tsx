import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {useAppTheme} from '../theme/appTheme';

interface HeaderBarProps {
  vehicleName: string;
  onVehiclePress?: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({vehicleName, onVehiclePress}) => {
  const theme = useAppTheme();

  return (
    <View className="flex-row items-center justify-between p-4">
      <View>
        <Text style={{color: theme.text, fontSize: 20, fontWeight: 'bold'}}>DriveSense</Text>
        <Text style={{color: theme.textSubtle, fontSize: 14}}>Dashboard</Text>
      </View>
      <TouchableOpacity
        onPress={onVehiclePress}
        className="rounded-full px-4 py-2"
        style={{backgroundColor: theme.cardSoft}}>
        <Text style={{color: theme.text, fontSize: 14}}>{vehicleName}</Text>
      </TouchableOpacity>
    </View>
  );
};
