import React, {createContext, useCallback, useContext, useMemo, useRef, useState} from 'react';
import {Alert, Animated, Easing, PanResponder, Pressable, ScrollView, Text, View, useWindowDimensions} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useNavigation} from '@react-navigation/native';
import type {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAppTheme} from '../theme/appTheme';
import {ProfileOverviewSidebar, type ProfileMenuItem} from './ProfileOverviewSidebar';
import {resolveProfileMenuRoute} from './profileOverviewData';
import {useProfileOverview} from './useProfileOverview';
import {authService, notifyLoggedOut} from '../services/apiClient';
import {useUserStore} from '../store/userStore';
import type {MainTabsParamList} from '../navigation/types';

type AppSidebarContextValue = {
  openSidebar: () => void;
  closeSidebar: () => void;
};

const AppSidebarContext = createContext<AppSidebarContextValue | null>(null);

export const useAppSidebar = () => {
  const context = useContext(AppSidebarContext);
  if (!context) {
    throw new Error('useAppSidebar must be used within AppSidebarProvider');
  }
  return context;
};

const OPEN_DURATION = 260;
const CLOSE_DURATION = 200;
const RADIUS = {sm: 16, md: 20, lg: 28} as const;
const HIT = 44;
/**
 * Page gutters are 20px, so a wide edge-catcher swallows drags meant for the horizontal chip rows
 * that start inside it. Keep the strip narrow and demand a clearly horizontal gesture.
 */
const EDGE_STRIP_WIDTH = 14;

export const AppSidebarProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const theme = useAppTheme();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabsParamList>>();
  const {width} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const overview = useProfileOverview();
  const clearUser = useUserStore((state) => state.clear);
  const drawerWidth = Math.min(340, Math.max(286, width - 32));
  const drawerTranslateX = useRef(new Animated.Value(-drawerWidth)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const drawerScale = useRef(new Animated.Value(0.96)).current;

  const animateTo = useCallback(
    (open: boolean) => {
      const duration = open ? OPEN_DURATION : CLOSE_DURATION;
      const easing = open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic);
      Animated.parallel([
        Animated.timing(drawerTranslateX, {toValue: open ? 0 : -drawerWidth, duration, easing, useNativeDriver: true}),
        Animated.timing(drawerScale, {toValue: open ? 1 : 0.96, duration, easing, useNativeDriver: true}),
        Animated.timing(overlayOpacity, {toValue: open ? 1 : 0, duration, easing, useNativeDriver: true}),
      ]).start();
    },
    [drawerScale, drawerTranslateX, drawerWidth, overlayOpacity],
  );

  const openSidebar = useCallback(() => {
    setIsSidebarOpen(true);
    animateTo(true);
  }, [animateTo]);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
    animateTo(false);
  }, [animateTo]);

  const handleMenuItemPress = useCallback(
    (item: ProfileMenuItem) => {
      closeSidebar();
      const destination = resolveProfileMenuRoute(item.label);
      if ('comingSoon' in destination) {
        navigation.navigate('ProfileStack', {
          screen: 'ComingSoon',
          params: {title: destination.comingSoon},
          initial: false,
        });
      } else {
        navigation.navigate(destination.tab, {screen: destination.screen} as never);
      }
    },
    [closeSidebar, navigation],
  );

  const handleLogout = useCallback(() => {
    closeSidebar();
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
  }, [clearUser, closeSidebar]);

  const edgePanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dx > 24 && Math.abs(gesture.dy) < 12 && gesture.dx > Math.abs(gesture.dy) * 2,
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > 45) {
            openSidebar();
          }
        },
      }),
    [openSidebar],
  );

  const drawerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => gesture.dx < -12 && Math.abs(gesture.dy) < 18,
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx < -45) {
            closeSidebar();
          }
        },
      }),
    [closeSidebar],
  );

  return (
    <AppSidebarContext.Provider value={{openSidebar, closeSidebar}}>
      <View style={{flex: 1}}>
        {children}
        {!isSidebarOpen ? (
          <View
            {...edgePanResponder.panHandlers}
            pointerEvents="box-only"
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              top: 0,
              width: EDGE_STRIP_WIDTH,
              zIndex: 20,
            }}
          />
        ) : null}
        <View className="absolute inset-0" style={{zIndex: 100}} pointerEvents={isSidebarOpen ? 'auto' : 'none'}>
          <Animated.View
            className="absolute inset-0"
            style={{
              backgroundColor: theme.scrim,
              opacity: overlayOpacity,
            }}>
            <Pressable className="flex-1" onPress={closeSidebar} />
          </Animated.View>
          <Animated.View
            {...drawerPanResponder.panHandlers}
            accessibilityViewIsModal
            importantForAccessibility={isSidebarOpen ? 'yes' : 'no-hide-descendants'}
            className="absolute bottom-0 left-0 top-0 px-5"
            style={{
              width: drawerWidth,
              // Cards need a surface to sit on, so the panel stays a step away from `card` rather
              // than matching it.
              backgroundColor: theme.screen,
              borderTopRightRadius: RADIUS.lg,
              borderBottomRightRadius: RADIUS.lg,
              shadowColor: '#000000',
              shadowOpacity: 0.18,
              shadowRadius: 24,
              shadowOffset: {width: 8, height: 0},
              elevation: 16,
              paddingTop: insets.top + 12,
              paddingBottom: insets.bottom,
              transform: [{translateX: drawerTranslateX}, {scale: drawerScale}],
            }}>
            <View className="mb-4 flex-row items-center justify-between">
              <Text style={{color: theme.text, ...theme.typography.cardTitle}}>Profile</Text>
              <Pressable
                onPress={closeSidebar}
                accessibilityRole="button"
                accessibilityLabel="Close menu"
                style={({pressed}) => ({
                  height: HIT,
                  width: HIT,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: RADIUS.sm,
                  backgroundColor: theme.cardSoft,
                  transform: [{scale: pressed ? 0.9 : 1}],
                  opacity: pressed ? 0.85 : 1,
                })}>
                <Ionicons name="close" size={20} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 24}}>
              <ProfileOverviewSidebar
                {...overview}
                onMenuItemPress={handleMenuItemPress}
                onLogout={handleLogout}
                style={{width: '100%'}}
              />
            </ScrollView>
          </Animated.View>
        </View>
      </View>
    </AppSidebarContext.Provider>
  );
};
