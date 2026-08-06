import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {Animated, PanResponder, Pressable, ScrollView, Text, TouchableOpacity, View, useWindowDimensions} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useAppTheme} from '../theme/appTheme';
import {ProfileOverviewSidebar} from './ProfileOverviewSidebar';
import {PROFILE_OVERVIEW_DATA} from './profileOverviewData';

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

export const AppSidebarProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const theme = useAppTheme();
  const {width} = useWindowDimensions();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const drawerWidth = Math.min(340, Math.max(286, width - 32));
  const drawerTranslateX = useRef(new Animated.Value(-drawerWidth)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const openSidebar = useCallback(() => {
    setIsSidebarOpen(true);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

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

  useEffect(() => {
    Animated.parallel([
      Animated.timing(drawerTranslateX, {
        toValue: isSidebarOpen ? 0 : -drawerWidth,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: isSidebarOpen ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [drawerTranslateX, drawerWidth, isSidebarOpen, overlayOpacity]);

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
        {isSidebarOpen ? (
          <View className="absolute inset-0" style={{zIndex: 100}}>
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
                transform: [{translateX: drawerTranslateX}],
              }}>
              <View className="mb-3 flex-row items-center justify-between">
                <Text style={{color: theme.text, fontSize: 18, fontWeight: '800'}}>Profile</Text>
                <TouchableOpacity
                  onPress={closeSidebar}
                  className="size-10 items-center justify-center rounded-[14px] border"
                  style={{backgroundColor: theme.card, borderColor: theme.cardBorder}}>
                  <Ionicons name="close" size={18} color={theme.text} />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 24}}>
                <ProfileOverviewSidebar {...PROFILE_OVERVIEW_DATA} style={{width: '100%'}} />
              </ScrollView>
            </Animated.View>
          </View>
        ) : null}
      </View>
    </AppSidebarContext.Provider>
  );
};
