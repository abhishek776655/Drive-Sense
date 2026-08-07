import React from 'react';
import {Pressable, ScrollView, Switch, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {SettingsScreenProps} from '../navigation/types';
import {useAppTheme, useThemeMode} from '../theme/appTheme';

export const SettingsScreen: React.FC<SettingsScreenProps> = ({navigation}) => {
  const theme = useAppTheme();
  const {mode, toggleThemeMode} = useThemeMode();
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
      </ScrollView>
    </SafeAreaView>
  );
};
