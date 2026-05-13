import React from 'react';
import {View, Text} from 'react-native';
import {useAppTheme} from '../theme/appTheme';

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
}

export const StatCard: React.FC<StatCardProps> = ({title, value, unit}) => {
  const theme = useAppTheme();

  return (
    <View
      className="mx-1 flex-1 rounded-xl p-4"
      style={{
        backgroundColor: theme.card,
        borderColor: theme.cardBorder,
        borderWidth: 1,
      }}>
      <Text className="mb-1" style={{color: theme.textSubtle, fontSize: 12}}>{title}</Text>
      <View className="flex-row items-baseline">
        <Text style={{color: theme.text, fontSize: 24, fontWeight: 'bold'}}>{value}</Text>
        {unit ? <Text className="ml-1" style={{color: theme.textMuted, fontSize: 14}}>{unit}</Text> : null}
      </View>
    </View>
  );
};
