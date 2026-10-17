import {Ionicons} from '@expo/vector-icons';
import {router, useFocusEffect} from 'expo-router';
import {useCallback, useState} from 'react';
import {ActivityIndicator, ScrollView, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {categoryStyle} from '../../components/achievements/AchievementIcon';
import {AchievementRow} from '../../components/achievements/AchievementRow';
import {LevelRing} from '../../components/achievements/LevelRing';
import {AppText} from '../../components/AppText';
import {GlassButton} from '../../components/GlassButton';
import {MapButton} from '../../components/trip/MapButton';
import type {AchievementCategory} from '../../services/achievementsService';
import {useAchievementsStore} from '../../stores/achievementsStore';
import {withAlpha} from '../../theme/color';
import {useAppTheme} from '../../theme/ThemeProvider';
import {ACHIEVEMENT_CATEGORIES, levelProgress, sortAchievements} from '../../utils/achievements';

function SectionTitle({label, count}: {label: string; count: number}) {
  const c = useAppTheme().colors;
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 26, marginBottom: 4}}>
      <AppText size={12} weight="black" tone="secondary" style={{letterSpacing: 1}}>
        {label}
      </AppText>
      <View style={{backgroundColor: c.separator, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 1}}>
        <AppText size={11} weight="black" tone="secondary">
          {count}
        </AppText>
      </View>
    </View>
  );
}

/** Level & Achievements (Rovy): level dial, XP toward the next level, and every achievement by category. */
export default function AchievementsScreen() {
  const theme = useAppTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const {data, error, load} = useAchievementsStore();
  const [category, setCategory] = useState<AchievementCategory | 'all'>('all');

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const progress = data ? levelProgress(data) : null;
  const shown = data ? data.achievements.filter((a) => category === 'all' || a.category === category) : [];
  const {unlocked, locked} = sortAchievements(shown);

  return (
    <View style={{flex: 1, backgroundColor: c.canvas}}>
      <ScrollView contentContainerStyle={{paddingTop: 76, paddingHorizontal: theme.space.screen, paddingBottom: insets.bottom + 40}}>
        <View style={{alignItems: 'center'}}>
          <AppText size={28} weight="black" tone="secondary" style={{lineHeight: 34}}>
            Level &
          </AppText>
          <AppText size={36} weight="black" style={{lineHeight: 42, letterSpacing: -0.5}}>
            Achievements
          </AppText>
        </View>

        {!data ? (
          <View style={{alignItems: 'center', marginTop: 60}}>
            {error ? (
              <AppText size={14} weight="bold" tone="secondary">
                {error}
              </AppText>
            ) : (
              <ActivityIndicator color={c.accent} />
            )}
          </View>
        ) : (
          <>
            <View style={{alignItems: 'center', marginTop: 24, gap: 14}}>
              <LevelRing level={data.level} fraction={progress?.fraction ?? 0} size={172} />
              <AppText size={26} weight="black">
                {data.title}
              </AppText>
              <View style={{backgroundColor: withAlpha(c.green, 0.16), borderRadius: 99, paddingHorizontal: 18, paddingVertical: 6}}>
                <AppText size={15} weight="black" color={c.green}>
                  ★ {data.xp.toLocaleString('en-IN')} XP
                </AppText>
              </View>
            </View>

            <View style={{marginTop: 22, gap: 6}}>
              <View style={{height: 21, borderRadius: 11, backgroundColor: c.separator, overflow: 'hidden'}}>
                <View style={{width: `${Math.max(3, (progress?.fraction ?? 0) * 100)}%`, height: '100%', borderRadius: 11, backgroundColor: c.green}} />
              </View>
              <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                <AppText size={9} weight="bold" tone="secondary">
                  {progress?.into ?? 0} XP
                </AppText>
                <AppText size={9} weight="bold" tone="secondary">
                  {progress && progress.span > 0 ? `${progress.span} XP to level ${data.level + 1}` : 'Top level'}
                </AppText>
              </View>
            </View>

            <View style={{flexDirection: 'row', marginTop: 26}}>
              {[
                {value: data.xp.toLocaleString('en-IN'), label: 'Total XP'},
                {value: `${data.unlocked}/${data.total}`, label: 'Achievements'},
              ].map((cell, i) => (
                <View key={cell.label} style={{flex: 1, flexDirection: 'row'}}>
                  {i > 0 ? <View style={{width: 1, marginVertical: 6, backgroundColor: c.separator}} /> : null}
                  <View style={{flex: 1, alignItems: 'center'}}>
                    <AppText size={26} weight="black">
                      {cell.value}
                    </AppText>
                    <AppText size={12} weight="semibold" tone="secondary">
                      {cell.label}
                    </AppText>
                  </View>
                </View>
              ))}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{marginHorizontal: -16, marginTop: 18}}
              contentContainerStyle={{paddingHorizontal: 16, paddingVertical: 8, gap: 8}}>
              {ACHIEVEMENT_CATEGORIES.map((cat) => {
                const on = cat.value === category;
                return (
                  <GlassButton
                    key={cat.value}
                    accessibilityLabel={cat.label}
                    accessibilityState={{selected: on}}
                    onPress={() => setCategory(cat.value)}
                    fill={on ? c.green : undefined}
                    style={{height: 32, paddingHorizontal: 14, flexDirection: 'row', gap: 6}}>
                    {/* Rovy: each category's glyph in green before its name; white once picked. */}
                    {cat.value !== 'all' ? <Ionicons name={categoryStyle(cat.value, c).icon} size={14} color={on ? c.onAccent : c.green} /> : null}
                    <AppText size={13} weight="extrabold" color={on ? c.onAccent : c.textPrimary}>
                      {cat.label}
                    </AppText>
                  </GlassButton>
                );
              })}
            </ScrollView>

            {unlocked.length > 0 ? (
              <>
                <SectionTitle label="UNLOCKED" count={unlocked.length} />
                {unlocked.map((a) => (
                  <AchievementRow key={a.id} achievement={a} />
                ))}
              </>
            ) : null}
            {locked.length > 0 ? (
              <>
                <SectionTitle label="LOCKED" count={locked.length} />
                {locked.map((a) => (
                  <AchievementRow key={a.id} achievement={a} />
                ))}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
      <View style={{position: 'absolute', top: 18, right: theme.space.screen}}>
        <MapButton icon="close" label="Close achievements" onPress={() => router.back()} size={44} color={c.textSecondary} />
      </View>
    </View>
  );
}
