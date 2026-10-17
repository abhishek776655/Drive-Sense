import React from 'react';
import {Text, View, type DimensionValue, type StyleProp, type ViewStyle} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useAppTheme} from '../theme/appTheme';

type Props = {
  label: string;
  value: string;
  unit?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  // 'badge': icon in a rounded square above the label (dashboard-style metric tile).
  // 'inline': icon and value share the top row, label sits below (event-count tile).
  variant?: 'badge' | 'inline';
  width?: DimensionValue;
  background?: string;
  style?: StyleProp<ViewStyle>;
};

export const StatTile: React.FC<Props> = ({label, value, unit, icon, iconColor, variant = 'badge', width, background, style}) => {
  const theme = useAppTheme();
  const tint = iconColor ?? theme.accent;

  return (
    <View
      style={[
        {
          width: width ?? '48%',
          minHeight: icon && variant === 'badge' ? 96 : undefined,
          marginBottom: 10,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: theme.cardBorder,
          backgroundColor: background ?? theme.card,
          paddingHorizontal: 12,
          paddingVertical: 12,
        },
        style,
      ]}>
      {icon && variant === 'badge' ? (
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 11,
            marginBottom: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.accentMuted,
          }}>
          <Ionicons name={icon} size={16} color={tint} />
        </View>
      ) : null}

      {icon && variant === 'inline' ? (
        <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
          <Ionicons name={icon} size={16} color={tint} />
          <Text style={{color: tint, ...theme.typography.metricValue, fontSize: 16}}>{value}</Text>
        </View>
      ) : null}

      <Text
        numberOfLines={1}
        style={{
          color: variant === 'inline' ? theme.text : theme.textSubtle,
          ...(variant === 'inline' ? theme.typography.body : theme.typography.caption),
          fontWeight: variant === 'inline' ? '700' : theme.typography.caption.fontWeight,
          marginTop: variant === 'inline' ? 10 : 0,
          marginBottom: variant === 'badge' ? 2 : 0,
        }}>
        {label}
      </Text>

      {variant === 'badge' ? (
        <View style={{flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', marginTop: 4}}>
          <Text numberOfLines={2} style={{color: theme.text, ...theme.typography.metricValue, flexShrink: 1}}>
            {value}
          </Text>
          {unit ? (
            <Text numberOfLines={1} style={{color: theme.textSubtle, ...theme.typography.caption, marginLeft: 4}}>
              {unit}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};
