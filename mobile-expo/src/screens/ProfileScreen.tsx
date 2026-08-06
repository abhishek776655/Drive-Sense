import React from 'react';
import {ScrollView, Switch, Text, TouchableOpacity, View, useWindowDimensions} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAppTheme, useThemeMode} from '../theme/appTheme';
import {authService, notifyLoggedOut} from '../services/apiClient';
import {useAppSidebar} from '../components/AppSidebar';
import {ProfileOverviewSidebar} from '../components/ProfileOverviewSidebar';
import {
  ACTIVE_VEHICLE,
  PROFILE_MENU_ITEMS,
  PROFILE_OVERVIEW_DATA,
  PROFILE_STATS,
  PROFILE_USER,
} from '../components/profileOverviewData';

const WIDE_PROFILE_BREAKPOINT = 900;

export const ProfileScreen: React.FC = () => {
  const theme = useAppTheme();
  const {mode, toggleThemeMode} = useThemeMode();
  const {openSidebar} = useAppSidebar();
  const {width} = useWindowDimensions();
  const isDarkMode = mode === 'dark';
  const isWideLayout = width >= WIDE_PROFILE_BREAKPOINT;

  const renderHeader = () => (
    <View className="mb-[18px] flex-row items-center justify-between">
      <TouchableOpacity
        onPress={openSidebar}
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
  );

  const renderProfileSummary = () => (
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
        <Text style={{color: theme.accent, fontSize: 28, fontWeight: '800'}}>{PROFILE_USER.initial}</Text>
      </View>
      <View className="flex-1">
        <Text style={{color: theme.text, fontSize: 18, fontWeight: '800'}}>{PROFILE_USER.name}</Text>
        <Text className="mt-1" style={{color: theme.textSubtle, fontSize: 12}}>{PROFILE_USER.email}</Text>
        <View
          className="mt-2.5 self-start rounded-full px-2.5 py-[5px]"
          style={{
            backgroundColor: 'rgba(34,197,94,0.12)',
            flexDirection: 'row',
            alignItems: 'center',
          }}>
          <View className="mr-1.5 size-1.5 rounded-full" style={{backgroundColor: '#22C55E'}} />
          <Text style={{color: '#22C55E', fontSize: 10, fontWeight: '700'}}>{PROFILE_USER.statusLabel}</Text>
        </View>
      </View>
    </View>
  );

  const renderStats = () => (
    <View
      className="mb-[14px] rounded-3xl border p-4"
      style={{
        backgroundColor: theme.card,
        borderColor: theme.cardBorder,
      }}>
      <View className="flex-row">
        {PROFILE_STATS.map((stat, index) => (
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
  );

  const renderActiveVehicle = () => (
    <View
      className="mb-[14px] rounded-3xl border p-3"
      style={{
        backgroundColor: theme.card,
        borderColor: theme.cardBorder,
      }}>
      <View className="mb-2.5 flex-row items-center justify-between">
        <Text style={{color: theme.text, fontSize: 13, fontWeight: '700'}}>{ACTIVE_VEHICLE.title}</Text>
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
          <Text style={{color: theme.text, fontSize: 16, fontWeight: '800'}}>{ACTIVE_VEHICLE.name}</Text>
          <Text className="mt-0.5" style={{color: theme.textSubtle, fontSize: 12}}>{ACTIVE_VEHICLE.plate}</Text>
        </View>
      </View>
    </View>
  );

  const renderAppearance = () => (
    <View className="mb-[14px]">
      <Text className="mb-2.5" style={{color: theme.textSubtle, fontSize: 11, fontWeight: '800', letterSpacing: 0.8}}>APPEARANCE</Text>
      <View
        className="rounded-3xl border px-[14px] py-[14px]"
        style={{
          backgroundColor: theme.card,
          borderColor: theme.cardBorder,
        }}>
        <View className="flex-row items-center">
          <View
            className="mr-3 size-9 items-center justify-center rounded-[14px]"
            style={{backgroundColor: theme.accentMuted}}>
            <Ionicons name={isDarkMode ? 'moon' : 'sunny'} size={18} color={theme.accent} />
          </View>
          <View className="flex-1">
            <Text style={{color: theme.text, fontSize: 14, fontWeight: '700'}}>Dark mode</Text>
            <Text className="mt-0.5" style={{color: theme.textSubtle, fontSize: 11}}>
              {isDarkMode ? 'Using the darker DriveSense palette' : 'Using the lighter DriveSense palette'}
            </Text>
          </View>
          <Switch
            value={isDarkMode}
            onValueChange={() => void toggleThemeMode()}
            trackColor={{false: theme.lineMuted, true: theme.accentSoft}}
            thumbColor={isDarkMode ? theme.accent : theme.card}
            ios_backgroundColor={theme.lineMuted}
          />
        </View>
      </View>
    </View>
  );

  const renderAccountMenu = () => (
    <View className="mb-[14px]">
      <Text className="mb-2.5" style={{color: theme.textSubtle, fontSize: 11, fontWeight: '800', letterSpacing: 0.8}}>ACCOUNT</Text>
      <View
        className="overflow-hidden rounded-3xl border"
        style={{
          backgroundColor: theme.card,
          borderColor: theme.cardBorder,
        }}>
        {PROFILE_MENU_ITEMS.map((item, index) => (
          <TouchableOpacity
            key={item.label}
            className="flex-row items-center px-[14px] py-[14px]"
            style={{
              borderBottomWidth: index < PROFILE_MENU_ITEMS.length - 1 ? 1 : 0,
              borderBottomColor: theme.cardBorder,
            }}>
            <Ionicons name={item.icon} size={18} color={theme.textSubtle} />
            <Text className="ml-3 flex-1" style={{color: theme.text, fontSize: 14}}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textSubtle} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderLogout = () => (
    <TouchableOpacity
      onPress={() => {
        void authService.logout().then(notifyLoggedOut);
      }}
      className="flex-row items-center justify-center rounded-[22px] border py-4"
      style={{
        backgroundColor: theme.card,
        borderColor: theme.cardBorder,
      }}>
      <Ionicons name="log-out-outline" size={18} color={theme.danger} />
      <Text className="ml-2" style={{color: theme.danger, fontSize: 15, fontWeight: '800'}}>Logout</Text>
    </TouchableOpacity>
  );

  if (isWideLayout) {
    return (
      <SafeAreaView className="flex-1" style={{backgroundColor: theme.screen}}>
        <View className="flex-1 flex-row justify-center px-6 pt-5" style={{gap: 18}}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 132}}>
            <ProfileOverviewSidebar {...PROFILE_OVERVIEW_DATA} />
          </ScrollView>
          <ScrollView
            className="flex-1"
            style={{maxWidth: 560}}
            contentContainerStyle={{paddingBottom: 132}}
            showsVerticalScrollIndicator={false}>
            {renderHeader()}
            {renderAppearance()}
            {renderLogout()}
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{backgroundColor: theme.screen}}>
      <ScrollView contentContainerStyle={{paddingBottom: 132}} className="px-5 pt-3" showsVerticalScrollIndicator={false}>
        {renderHeader()}
        {renderProfileSummary()}
        {renderStats()}
        {renderActiveVehicle()}
        {renderAppearance()}
        {renderAccountMenu()}
        {renderLogout()}
      </ScrollView>
    </SafeAreaView>
  );
};
