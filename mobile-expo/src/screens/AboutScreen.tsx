import React from 'react';
import {Pressable, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {AboutScreenProps} from '../navigation/types';
import {useAppTheme} from '../theme/appTheme';
import appConfig from '../../app.json';

export const AboutScreen: React.FC<AboutScreenProps> = ({navigation}) => {
  const theme = useAppTheme();
  const version = appConfig.expo.version;

  return (
    <SafeAreaView className="flex-1" style={{backgroundColor: theme.screen}}>
      <View className="px-5 pt-3">
        <View className="mb-6 flex-row items-center justify-between">
          <Pressable
            className="size-10 items-center justify-center rounded-[14px] border"
            style={{backgroundColor: theme.card, borderColor: theme.cardBorder}}
            onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={18} color={theme.text} />
          </Pressable>
          <Text style={{color: theme.text, fontSize: 22, fontWeight: '800'}}>About</Text>
          <View className="size-10" />
        </View>
      </View>

      <View className="flex-1 items-center justify-center px-8">
        <View
          className="mb-5 size-20 items-center justify-center rounded-full"
          style={{backgroundColor: theme.accentMuted}}>
          <Ionicons name="car-sport" size={36} color={theme.accent} />
        </View>
        <View className="flex-row items-baseline">
          <Text style={{color: theme.text, fontSize: 22, fontWeight: '800'}}>Drive</Text>
          <Text style={{color: theme.accent, fontSize: 22, fontWeight: '800'}}>Sense</Text>
        </View>
        <Text className="mt-1" style={{color: theme.textSubtle, fontSize: 13}}>Version {version}</Text>
        <Text className="mt-4 text-center" style={{color: theme.textSubtle, ...theme.typography.body}}>
          DriveSense turns your everyday drives into clear, actionable insight — trip scoring, live
          telemetry, and per-vehicle history, all in one place.
        </Text>
      </View>
    </SafeAreaView>
  );
};
