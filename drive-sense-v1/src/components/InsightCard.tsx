import React from 'react';
import {View, Text} from 'react-native';
import {useAppTheme} from '../theme/appTheme';

interface InsightCardProps {
  type: 'warning' | 'info' | 'success';
  message: string;
}

const typeStyles = {
  warning: {bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', text: '#ef4444', icon: '⚠️'},
  info: {bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)', text: '#3b82f6', icon: 'ℹ️'},
  success: {bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.3)', text: '#22c55e', icon: '✓'},
};

export const InsightCard: React.FC<InsightCardProps> = ({type, message}) => {
  useAppTheme();
  const style = typeStyles[type];
  return (
    <View className="mb-2 rounded-lg border p-3" style={{backgroundColor: style.bg, borderColor: style.border}}>
      <View className="flex-row items-center gap-2">
        <Text style={{fontSize: 18}}>{style.icon}</Text>
        <Text style={{color: style.text, flex: 1, fontSize: 14}}>{message}</Text>
      </View>
    </View>
  );
};
