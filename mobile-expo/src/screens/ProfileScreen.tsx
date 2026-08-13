import React from 'react';
import {Alert, ScrollView, Text, TouchableOpacity, View, useWindowDimensions} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAppTheme} from '../theme/appTheme';
import {authService, notifyLoggedOut} from '../services/apiClient';
import {useAppSidebar} from '../components/AppSidebar';
import {ProfileOverviewSidebar, type ProfileMenuItem} from '../components/ProfileOverviewSidebar';
import {useProfileOverview} from '../components/useProfileOverview';
import {resolveProfileMenuRoute} from '../components/profileOverviewData';
import {useUserStore} from '../store/userStore';
import {ProfileScreenProps} from '../navigation/types';

const WIDE_PROFILE_BREAKPOINT = 900;
const RADIUS = {sm: 16, md: 20, lg: 28} as const;
const HIT = 44;

export const ProfileScreen: React.FC<ProfileScreenProps> = ({navigation}) => {
  const theme = useAppTheme();
  const {openSidebar} = useAppSidebar();
  const {width} = useWindowDimensions();
  const isWideLayout = width >= WIDE_PROFILE_BREAKPOINT;
  const overview = useProfileOverview();
  const clearUser = useUserStore((state) => state.clear);

  const handleMenuItemPress = (item: ProfileMenuItem) => {
    const destination = resolveProfileMenuRoute(item.label);
    if ('comingSoon' in destination) {
      navigation.navigate('ComingSoon', {title: destination.comingSoon});
    } else if (destination.tab === 'ProfileStack') {
      navigation.navigate(destination.screen as 'Settings' | 'HelpSupport' | 'About');
    } else {
      navigation.navigate(destination.tab, {screen: destination.screen} as never);
    }
  };

  // Signing out drops the token and cannot be undone from here, so it asks first — the same
  // treatment archiving a vehicle already gets.
  const handleLogout = () => {
    Alert.alert('Log out', 'You will need to sign in again to see your trips.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          void authService.logout().then(() => {
            clearUser();
            notifyLoggedOut();
          });
        },
      },
    ]);
  };

  // Settings used to be reachable from a header icon, a dedicated row, and the menu list. The menu
  // list keeps it; the other two are gone.
  const renderHeader = () => (
    <View className="mb-[18px] flex-row items-center justify-between">
      <TouchableOpacity
        onPress={openSidebar}
        accessibilityRole="button"
        accessibilityLabel="Open menu"
        className="items-center justify-center border"
        style={{
          width: HIT,
          height: HIT,
          borderRadius: RADIUS.sm,
          backgroundColor: theme.card,
          borderColor: theme.cardBorder,
        }}>
        <Ionicons name="menu" size={20} color={theme.text} />
      </TouchableOpacity>
      <Text style={{color: theme.text, ...theme.typography.pageTitle, fontSize: 22, lineHeight: 26}}>Profile</Text>
      <View style={{width: HIT, height: HIT}} />
    </View>
  );

  if (isWideLayout) {
    return (
      <SafeAreaView className="flex-1" style={{backgroundColor: theme.screen}}>
        <View className="flex-1 flex-row justify-center px-6 pt-5" style={{gap: 18}}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 132}}>
            <ProfileOverviewSidebar
              {...overview}
              onMenuItemPress={handleMenuItemPress}
              onLogout={handleLogout}
              style={{width: 330}}
            />
          </ScrollView>
          <ScrollView
            className="flex-1"
            style={{maxWidth: 560}}
            contentContainerStyle={{paddingBottom: 132}}
            showsVerticalScrollIndicator={false}>
            {renderHeader()}
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{backgroundColor: theme.screen}}>
      <ScrollView contentContainerStyle={{paddingBottom: 132}} className="px-5 pt-3" showsVerticalScrollIndicator={false}>
        {renderHeader()}
        <ProfileOverviewSidebar {...overview} onMenuItemPress={handleMenuItemPress} onLogout={handleLogout} />
      </ScrollView>
    </SafeAreaView>
  );
};
