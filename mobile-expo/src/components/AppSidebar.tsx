import React, {createContext, useCallback, useContext, useMemo, useRef, useState} from 'react';
import {Animated, Easing, PanResponder, Pressable, ScrollView, Text, View, useWindowDimensions} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useNavigation} from '@react-navigation/native';
import type {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import {useAppTheme} from '../theme/appTheme';
import {ProfileOverviewSidebar, type ProfileMenuItem} from './ProfileOverviewSidebar';
import {PROFILE_OVERVIEW_DATA, resolveProfileMenuRoute} from './profileOverviewData';
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

export const AppSidebarProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const theme = useAppTheme();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabsParamList>>();
  const {width} = useWindowDimensions();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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
        navigation.navigate('ProfileStack', {screen: 'ComingSoon', params: {title: destination.comingSoon}});
      } else {
        navigation.navigate(destination.tab, {screen: destination.screen} as never);
      }
    },
    [closeSidebar, navigation],
  );

  const edgePanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => gesture.dx > 12 && Math.abs(gesture.dy) < 18,
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
              width: 22,
              zIndex: 20,
            }}
          />
        ) : null}
        <View className="absolute inset-0" style={{zIndex: 100}} pointerEvents={isSidebarOpen ? 'auto' : 'none'}>
          <Animated.View
            className="absolute inset-0"
            style={{
              backgroundColor: 'rgba(15,23,42,0.42)',
              opacity: overlayOpacity,
            }}>
            <Pressable className="flex-1" onPress={closeSidebar} />
          </Animated.View>
          <Animated.View
            {...drawerPanResponder.panHandlers}
            className="absolute bottom-0 left-0 top-0 px-4 py-5"
            style={{
              width: drawerWidth,
              backgroundColor: theme.screen,
              transform: [{translateX: drawerTranslateX}, {scale: drawerScale}],
            }}>
            <View className="mb-3 flex-row items-center justify-between">
              <Text style={{color: theme.text, fontSize: 18, fontWeight: '800'}}>Profile</Text>
              <Pressable
                onPress={closeSidebar}
                style={({pressed}) => ({
                  height: 40,
                  width: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 20,
                  backgroundColor: theme.accentMuted,
                  transform: [{scale: pressed ? 0.9 : 1}],
                  opacity: pressed ? 0.85 : 1,
                })}>
                <Ionicons name="close" size={20} color={theme.accent} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 24}}>
              <ProfileOverviewSidebar
                {...PROFILE_OVERVIEW_DATA}
                onMenuItemPress={handleMenuItemPress}
                style={{width: '100%'}}
              />
            </ScrollView>
          </Animated.View>
        </View>
      </View>
    </AppSidebarContext.Provider>
  );
};
