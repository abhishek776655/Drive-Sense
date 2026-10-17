import React from 'react';
import {Pressable, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ComingSoonScreenProps} from '../navigation/types';
import {useAppTheme} from '../theme/appTheme';

export const ComingSoonScreen: React.FC<ComingSoonScreenProps> = ({navigation, route}) => {
  const theme = useAppTheme();
  const {title, message} = route.params;

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
          <Text style={{color: theme.text, fontSize: 22, fontWeight: '800'}}>{title}</Text>
          <View className="size-10" />
        </View>
      </View>

      <View className="flex-1 items-center justify-center px-8">
        <View
          className="mb-5 size-20 items-center justify-center rounded-full"
          style={{backgroundColor: theme.accentMuted}}>
          <Ionicons name="construct-outline" size={36} color={theme.accent} />
        </View>
        <Text style={{color: theme.text, ...theme.typography.sectionTitle, fontSize: 18, textAlign: 'center'}}>
          {title}
        </Text>
        <Text className="mt-2 text-center" style={{color: theme.textSubtle, ...theme.typography.body}}>
          {message ?? "We're still building this — check back soon."}
        </Text>
      </View>
    </SafeAreaView>
  );
};
