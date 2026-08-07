import React from 'react';
import {Linking, Pressable, ScrollView, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {HelpSupportScreenProps} from '../navigation/types';
import {useAppTheme} from '../theme/appTheme';

const SUPPORT_EMAIL = 'support@drivesense.app';

const FAQ_ITEMS = [
  {
    question: 'How is my driving score calculated?',
    answer:
      'Your score starts at 100 and drops each time a trip records a harsh brake, rapid acceleration, or overspeed event — the more severe and frequent the events, the bigger the deduction.',
  },
  {
    question: 'Why didn’t my trip start automatically?',
    answer: 'Trips auto-start once your speed passes 2.2 m/s (about 8 km/h) — a quick roll or a stationary car won’t trigger one.',
  },
  {
    question: 'Why did my trip end automatically?',
    answer: 'A trip auto-ends after 180 seconds of staying idle in one spot with a stable GPS signal, e.g. after you park and the app confirms you’ve stopped moving.',
  },
  {
    question: 'What counts as harsh braking or rapid acceleration?',
    answer: 'Rapid acceleration is 3.0 m/s² or more, harsh braking is -3.5 m/s² or steeper, and overspeed is above 27.78 m/s (100 km/h).',
  },
];

export const HelpSupportScreen: React.FC<HelpSupportScreenProps> = ({navigation}) => {
  const theme = useAppTheme();

  const handleContactSupport = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {});
  };

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
          <Text style={{color: theme.text, fontSize: 22, fontWeight: '800'}}>Help & Support</Text>
          <View className="size-10" />
        </View>

        <Text className="mb-2.5" style={{color: theme.textSubtle, fontSize: 11, fontWeight: '800', letterSpacing: 0.8}}>
          FREQUENTLY ASKED
        </Text>
        <View
          className="mb-[14px] overflow-hidden rounded-3xl border"
          style={{backgroundColor: theme.card, borderColor: theme.cardBorder}}>
          {FAQ_ITEMS.map((item, index) => (
            <View
              key={item.question}
              className="px-[14px] py-[14px]"
              style={{
                borderBottomWidth: index < FAQ_ITEMS.length - 1 ? 1 : 0,
                borderBottomColor: theme.cardBorder,
              }}>
              <Text style={{color: theme.text, fontSize: 14, fontWeight: '700'}}>{item.question}</Text>
              <Text className="mt-1.5" style={{color: theme.textSubtle, fontSize: 12, lineHeight: 18}}>
                {item.answer}
              </Text>
            </View>
          ))}
        </View>

        <Text className="mb-2.5" style={{color: theme.textSubtle, fontSize: 11, fontWeight: '800', letterSpacing: 0.8}}>
          NEED MORE HELP
        </Text>
        <Pressable
          onPress={handleContactSupport}
          className="flex-row items-center rounded-3xl border px-[14px] py-[14px]"
          style={{backgroundColor: theme.card, borderColor: theme.cardBorder}}>
          <View
            className="mr-3 size-9 items-center justify-center rounded-[14px]"
            style={{backgroundColor: theme.accentMuted}}>
            <Ionicons name="mail-outline" size={18} color={theme.accent} />
          </View>
          <View className="flex-1">
            <Text style={{color: theme.text, fontSize: 14, fontWeight: '700'}}>Contact support</Text>
            <Text className="mt-0.5" style={{color: theme.textSubtle, fontSize: 11}}>{SUPPORT_EMAIL}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.textSubtle} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};
