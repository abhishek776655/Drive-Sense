import React from 'react';
import {ScrollView, Text, TouchableOpacity, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAppTheme} from '../theme/appTheme';

const MENU_ITEMS = [
  {icon: 'car-outline', label: 'My Vehicles'},
  {icon: 'time-outline', label: 'Trips History'},
  {icon: 'document-text-outline', label: 'Reports & Export'},
  {icon: 'location-outline', label: 'Geofencing'},
  {icon: 'notifications-outline', label: 'Alerts & Notifications'},
  {icon: 'settings-outline', label: 'Settings'},
  {icon: 'help-circle-outline', label: 'Help & Support'},
  {icon: 'information-circle-outline', label: 'About Drive Sense'},
];

export const ProfileScreen: React.FC = () => {
  const theme = useAppTheme();

  return (
    <SafeAreaView className="flex-1" style={{backgroundColor: theme.screen}}>
      <ScrollView contentContainerStyle={{paddingBottom: 132}} className="px-5 pt-3" showsVerticalScrollIndicator={false}>
        <View className="mb-[18px] flex-row items-center justify-between">
          <TouchableOpacity
            className="size-10 items-center justify-center rounded-[14px] border"
            style={{
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            }}>
            <Ionicons name="menu" size={18} color={theme.text} />
          </TouchableOpacity>
          <Text style={{color: theme.text, fontSize: 22, fontWeight: '800'}}>More</Text>
          <TouchableOpacity
            className="size-10 items-center justify-center rounded-[14px] border"
            style={{
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            }}>
            <Ionicons name="settings-outline" size={18} color={theme.text} />
          </TouchableOpacity>
        </View>

        <View
          className="mb-[14px] flex-row items-center rounded-3xl border p-4"
          style={{
            backgroundColor: theme.card,
            borderColor: theme.cardBorder,
          }}>
          <View
            className="mr-[14px] size-[76px] items-center justify-center rounded-3xl"
            style={{
              backgroundColor: theme.accentMuted,
            }}>
            <Text style={{color: theme.accent, fontSize: 28, fontWeight: '800'}}>D</Text>
          </View>
          <View className="flex-1">
            <Text style={{color: theme.text, fontSize: 18, fontWeight: '800'}}>Demo User</Text>
            <Text className="mt-1" style={{color: theme.textSubtle, fontSize: 12}}>demo@drivesense.com</Text>
            <View
              className="mt-2.5 self-start rounded-full px-2.5 py-[5px]"
              style={{
                backgroundColor: 'rgba(34,197,94,0.12)',
                flexDirection: 'row',
                alignItems: 'center',
              }}>
              <View className="mr-1.5 size-1.5 rounded-full" style={{backgroundColor: '#22C55E'}} />
              <Text style={{color: '#22C55E', fontSize: 10, fontWeight: '700'}}>Connected</Text>
            </View>
          </View>
        </View>

        <View
          className="mb-[14px] rounded-3xl border p-4"
          style={{
            backgroundColor: theme.card,
            borderColor: theme.cardBorder,
          }}>
          <View className="flex-row">
            {[
              {value: '3', label: 'Vehicles'},
              {value: '156', label: 'Trips'},
              {value: '2.4k', label: 'km Driven'},
            ].map((stat, index) => (
              <View
                key={stat.label}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingRight: index < 2 ? 10 : 0,
                  marginRight: index < 2 ? 10 : 0,
                  borderRightWidth: index < 2 ? 1 : 0,
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
            <Text style={{color: theme.text, fontSize: 13, fontWeight: '700'}}>My Car</Text>
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
              <Text style={{color: theme.text, fontSize: 16, fontWeight: '800'}}>Honda City</Text>
              <Text className="mt-0.5" style={{color: theme.textSubtle, fontSize: 12}}>DL 10 AB 1234</Text>
            </View>
          </View>
        </View>

        <View className="mb-[14px]">
          <Text className="mb-2.5" style={{color: theme.textSubtle, fontSize: 11, fontWeight: '800', letterSpacing: 0.8}}>ACCOUNT</Text>
          <View
            className="overflow-hidden rounded-3xl border"
            style={{
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            }}>
            {MENU_ITEMS.map((item, index) => (
              <TouchableOpacity
                key={item.label}
                className="flex-row items-center px-[14px] py-[14px]"
                style={{
                  borderBottomWidth: index < MENU_ITEMS.length - 1 ? 1 : 0,
                  borderBottomColor: theme.cardBorder,
                }}>
                <Ionicons name={item.icon as any} size={18} color={theme.textSubtle} />
                <Text className="ml-3 flex-1" style={{color: theme.text, fontSize: 14}}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.textSubtle} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          className="flex-row items-center justify-center rounded-[22px] border py-4"
          style={{
            backgroundColor: theme.card,
            borderColor: theme.cardBorder,
          }}>
          <Ionicons name="log-out-outline" size={18} color={theme.danger} />
          <Text className="ml-2" style={{color: theme.danger, fontSize: 15, fontWeight: '800'}}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};
