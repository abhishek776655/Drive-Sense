import React from 'react';
import {Text, TouchableOpacity, View, type StyleProp, type ViewStyle} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useAppTheme} from '../theme/appTheme';

export type ProfileMenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
};

export type ProfileOverviewSidebarProps = {
  user: {
    initial: string;
    name: string;
    email: string;
    statusLabel: string;
  };
  stats: Array<{
    value: string;
    label: string;
  }>;
  activeVehicle: {
    title: string;
    name: string;
    plate: string;
  };
  menuItems: ProfileMenuItem[];
  onMenuItemPress?: (item: ProfileMenuItem) => void;
  style?: StyleProp<ViewStyle>;
};

export const ProfileOverviewSidebar: React.FC<ProfileOverviewSidebarProps> = ({
  user,
  stats,
  activeVehicle,
  menuItems,
  onMenuItemPress,
  style,
}) => {
  const theme = useAppTheme();

  return (
    <View className="w-[330px]" style={style}>
      <View
        className="mb-[14px] items-center rounded-3xl border p-4"
        style={{
          backgroundColor: theme.card,
          borderColor: theme.cardBorder,
        }}>
        <View
          className="mb-4 size-[76px] items-center justify-center rounded-3xl"
          style={{
            backgroundColor: theme.accentMuted,
          }}>
          <Text style={{color: theme.accent, fontSize: 28, fontWeight: '800'}}>{user.initial || '?'}</Text>
        </View>
        <Text style={{color: theme.text, fontSize: 20, fontWeight: '800', textAlign: 'center'}}>{user.name || 'Profile'}</Text>
        <Text className="mt-1" style={{color: theme.textSubtle, fontSize: 12, textAlign: 'center'}}>
          {user.email || 'No email available'}
        </Text>
      </View>

      <View
        className="mb-[14px] rounded-3xl border p-4"
        style={{
          backgroundColor: theme.card,
          borderColor: theme.cardBorder,
        }}>
        <View className="flex-row">
          {stats.map((stat, index) => (
            <View
              key={stat.label}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingRight: index < stats.length - 1 ? 10 : 0,
                marginRight: index < stats.length - 1 ? 10 : 0,
                borderRightWidth: index < stats.length - 1 ? 1 : 0,
                borderRightColor: theme.cardBorder,
              }}>
              <Text style={{color: theme.text, fontSize: 20, fontWeight: '800'}}>{stat.value}</Text>
              <Text style={{color: theme.textSubtle, fontSize: 11, marginTop: 3}}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View
        className="mb-[14px] rounded-3xl border p-3"
        style={{
          backgroundColor: theme.card,
          borderColor: theme.cardBorder,
        }}>
        <View className="mb-2.5 flex-row items-center justify-between">
          <Text style={{color: theme.text, fontSize: 13, fontWeight: '700'}}>
            {activeVehicle.title || 'Vehicle'}
          </Text>
          <Text style={{color: theme.success, fontSize: 11, fontWeight: '700'}}>Active</Text>
        </View>
        <View className="flex-row items-center">
          <View
            className="mr-3 h-14 w-[88px] items-center justify-center rounded-2xl"
            style={{
              backgroundColor: theme.cardSoft,
            }}>
            <Ionicons name="car-sport" size={28} color={theme.text} />
          </View>
          <View className="flex-1">
            <Text style={{color: theme.text, fontSize: 16, fontWeight: '800'}}>
              {activeVehicle.name || 'No vehicle'}
            </Text>
            <Text className="mt-0.5" style={{color: theme.textSubtle, fontSize: 12}}>
              {activeVehicle.plate || 'No plate available'}
            </Text>
          </View>
        </View>
      </View>

      <View
        className="overflow-hidden rounded-3xl border"
        style={{
          backgroundColor: theme.card,
          borderColor: theme.cardBorder,
        }}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={item.label}
            onPress={() => onMenuItemPress?.(item)}
            className="flex-row items-center px-[14px] py-[14px]"
            style={{
              borderBottomWidth: index < menuItems.length - 1 ? 1 : 0,
              borderBottomColor: theme.cardBorder,
            }}>
            <Ionicons name={item.icon} size={18} color={theme.textSubtle} />
            <Text className="ml-3 flex-1" style={{color: theme.text, fontSize: 14}}>
              {item.label}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textSubtle} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};
