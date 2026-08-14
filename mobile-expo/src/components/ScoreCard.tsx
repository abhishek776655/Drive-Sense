import React from 'react';
import {View, Text} from 'react-native';
import {useAppTheme} from '../theme/appTheme';
import {Card} from './Card';

interface ScoreCardProps {
  score: number;
  scoreDelta: number;
}

export const ScoreCard: React.FC<ScoreCardProps> = ({score, scoreDelta}) => {
  const theme = useAppTheme();
  const isPositive = scoreDelta >= 0;
  const deltaColor = isPositive ? theme.success : theme.danger;
  const deltaPrefix = isPositive ? '+' : '';
  const scoreTone = score >= 90 ? theme.success : score >= 80 ? theme.accent : theme.warning;
  const quality = score >= 90 ? 'Excellent' : score >= 80 ? 'Great' : score >= 70 ? 'Fair' : 'Needs work';

  const breakdown = [
    {label: 'Braking', value: score >= 85 ? 'Good' : 'Avg.', tone: score >= 85 ? theme.success : theme.warning},
    {label: 'Acceleration', value: score >= 80 ? 'Good' : 'Avg.', tone: score >= 80 ? theme.success : theme.warning},
    {label: 'Speeding', value: score >= 90 ? 'Great' : 'Avg.', tone: score >= 90 ? theme.success : theme.warning},
    {label: 'Cornering', value: score >= 82 ? 'Good' : 'Avg.', tone: score >= 82 ? theme.success : theme.warning},
  ];

  return (
    <Card
      radius={24}
      padding={18}
      style={{
        marginBottom: 12,
        overflow: 'hidden',
      }}>
      <View
        pointerEvents="none"
        className="absolute"
        style={{
          width: 200,
          height: 200,
          borderRadius: 100,
          backgroundColor: theme.accentMuted,
          top: -110,
          right: -70,
          opacity: 0.7,
        }}
      />

      <Text style={{color: theme.textSubtle, ...theme.typography.sectionTitle, marginBottom: 12}}>Driving Score</Text>

      <View className="flex-row items-center">
        <View
          className="items-center justify-center rounded-full border-[10px]"
          style={{
            width: 118,
            height: 118,
            borderRadius: 59,
            borderColor: scoreTone,
            backgroundColor: theme.cardSoft,
            shadowColor: scoreTone,
            shadowOpacity: 0.18,
            shadowRadius: 20,
            shadowOffset: {width: 0, height: 10},
            elevation: 4,
          }}>
          <Text style={{color: theme.text, ...theme.typography.scoreValue, fontSize: 30, lineHeight: 32}}>{score}</Text>
          <Text style={{color: theme.textSubtle, ...theme.typography.caption}}>/100</Text>
        </View>

        <View className="flex-1 pl-3.5">
          <Text style={{color: theme.text, ...theme.typography.body}}>
            Your driving behavior is {quality.toLowerCase()} this week.
          </Text>

          <View
            className="mt-2.5 flex-row items-center self-start rounded-full px-2.5 py-1.5"
            style={{
              backgroundColor: theme.accentMuted,
            }}>
            <View className="mr-1.5 h-1.5 w-1.5 rounded-full" style={{backgroundColor: scoreTone}} />
            <Text style={{color: scoreTone, ...theme.typography.caption}}>{quality}</Text>
          </View>

          <View className="mt-3">
            <Text style={{color: theme.textSubtle, ...theme.typography.caption, marginBottom: 4}}>Weekly change</Text>
            <Text style={{color: deltaColor, ...theme.typography.body, fontWeight: '700'}}>
              {deltaPrefix}{scoreDelta} vs last week
            </Text>
          </View>
        </View>
      </View>

      <View className="mt-3.5 flex-row flex-wrap justify-between">
        {breakdown.map((item, index) => (
          <View
            key={item.label}
            className="items-center rounded-2xl border px-2 py-2.5"
            style={{
              width: '48.5%',
              backgroundColor: theme.cardSoft,
              borderColor: theme.cardBorder,
              borderWidth: 1,
              marginBottom: index < breakdown.length - 2 ? 8 : 0,
            }}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              style={{color: theme.textSubtle, ...theme.typography.caption}}>
              {item.label}
            </Text>
            <Text style={{color: item.tone, fontSize: 12, fontWeight: '700', marginTop: 3}}>{item.value}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
};
