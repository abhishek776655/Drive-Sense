import React from 'react';
import {Pressable, ScrollView, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {SettingsScreenProps} from '../navigation/types';
import {SegmentedTabs} from '../components/SegmentedTabs';
import {THEME_PREFERENCE_OPTIONS, useAppTheme, useThemeMode, type ThemePreference} from '../theme/appTheme';

const PREFERENCE_ICON: Record<ThemePreference, keyof typeof Ionicons.glyphMap> = {
  system: 'phone-portrait-outline',
  light: 'sunny',
  dark: 'moon',
};

/** Says what the choice does, and for `system` what it currently resolves to. */
const preferenceCaption = (preference: ThemePreference, isDarkMode: boolean) => {
  if (preference === 'system') {
    return `Following your device — currently ${isDarkMode ? 'dark' : 'light'}`;
  }

  return isDarkMode ? 'Always the darker DriveSense palette' : 'Always the lighter DriveSense palette';
};

export const SettingsScreen: React.FC<SettingsScreenProps> = ({navigation}) => {
  const theme = useAppTheme();
  const {mode, preference, setThemePreference} = useThemeMode();
  const isDarkMode = mode === 'dark';

  return (
    <SafeAreaView className="flex-1" style={{backgroundColor: theme.screen}}>
      <ScrollView contentContainerStyle={{paddingBottom: 132}} className="px-5 pt-3" showsVerticalScrollIndicator={false}>
        <View className="mb-6 flex-row items-center justify-between">
          <Pressable
            className="size-10 items-center justify-center rounded-[14px] border"
            style={{backgroundColor: theme.card, borderColor: theme.cardBorder}}
            onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={18} color={theme.text} />
          </Pressable>
          <Text style={{color: theme.text, fontSize: 22, fontWeight: '800'}}>Settings</Text>
          <View className="size-10" />
        </View>

        <Text className="mb-2.5" style={{color: theme.textSubtle, fontSize: 11, fontWeight: '800', letterSpacing: 0.8}}>
          APPEARANCE
        </Text>
        <View
          className="rounded-3xl border px-[14px] py-[14px]"
          style={{backgroundColor: theme.card, borderColor: theme.cardBorder}}>
          <View className="flex-row items-center">
            <View
              className="mr-3 size-9 items-center justify-center rounded-[14px]"
              style={{backgroundColor: theme.accentMuted}}>
              <Ionicons name={PREFERENCE_ICON[preference]} size={18} color={theme.accent} />
            </View>
            <View className="flex-1">
              <Text style={{color: theme.text, fontSize: 14, fontWeight: '700'}}>Theme</Text>
              <Text className="mt-0.5" style={{color: theme.textSubtle, fontSize: 11}}>
                {preferenceCaption(preference, isDarkMode)}
              </Text>
            </View>
          </View>

          <View className="mt-3.5">
            <SegmentedTabs
              stretch
              accessibilityLabel="Theme"
              options={THEME_PREFERENCE_OPTIONS}
              value={preference}
              onChange={(next) => void setThemePreference(next)}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
