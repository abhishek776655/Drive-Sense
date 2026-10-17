import {Ionicons} from '@expo/vector-icons';
import {Pressable, View} from 'react-native';
import type {AchievementsOverview} from '../../services/achievementsService';
import {withAlpha} from '../../theme/color';
import {useAppTheme} from '../../theme/ThemeProvider';
import {levelProgress} from '../../utils/achievements';
import {AppText} from '../AppText';
import {Card} from '../Card';

/** Rovy's level card in Settings: badge, title, XP bar toward the next level, achievements count. */
export function LevelCard({data, onPress}: {data: AchievementsOverview; onPress: () => void}) {
  const c = useAppTheme().colors;
  const {into, span, fraction} = levelProgress(data);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Level ${data.level}, ${data.title}, achievements`} onPress={onPress}>
      {({pressed}) => (
        <Card style={{flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, opacity: pressed ? 0.7 : 1}}>
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: c.green,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: c.green,
              shadowOpacity: 0.45,
              shadowRadius: 10,
              shadowOffset: {width: 0, height: 4},
            }}>
            <AppText size={26} weight="black" tone="onAccent">
              {data.level}
            </AppText>
          </View>
          <View style={{flex: 1, gap: 6}}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
              <AppText size={16} weight="black">
                {data.title}
              </AppText>
              <View style={{backgroundColor: withAlpha(c.green, 0.16), borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2}}>
                <AppText size={11} weight="black" color={c.green}>
                  LVL {data.level}
                </AppText>
              </View>
            </View>
            <View style={{height: 17, borderRadius: 9, backgroundColor: c.separator, overflow: 'hidden'}}>
              <View style={{width: `${Math.max(4, fraction * 100)}%`, height: '100%', borderRadius: 9, backgroundColor: c.green}} />
            </View>
            <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
              <AppText size={9} weight="bold" tone="secondary">
                {span > 0 ? `${into} / ${span} XP` : `${data.xp} XP`}
              </AppText>
              <AppText size={11} weight="bold" tone="tertiary">
                {data.unlocked}/{data.total}
              </AppText>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={17} color={c.textTertiary} />
        </Card>
      )}
    </Pressable>
  );
}
