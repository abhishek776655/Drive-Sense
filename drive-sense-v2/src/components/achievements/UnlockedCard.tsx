import {useEffect, useState} from 'react';
import {View} from 'react-native';
import {useUnits} from '../../hooks/useUnits';
import {achievementsService, type Achievement} from '../../services/achievementsService';
import {useAchievementsStore} from '../../stores/achievementsStore';
import {useAppTheme} from '../../theme/ThemeProvider';
import {achievementDescription} from '../../utils/achievements';
import {AppText} from '../AppText';
import {Card} from '../Card';
import {AchievementIcon} from './AchievementIcon';

/**
 * On the drive summary: what this drive unlocked. Asked for once the trip is stored (achievements
 * are worked out from stored drives), and shows nothing when the drive unlocked nothing.
 */
export function UnlockedCard({tripId, ready}: {tripId: string | null; ready: boolean}) {
  const c = useAppTheme().colors;
  const {units} = useUnits();
  const [earned, setEarned] = useState<Achievement[]>([]);

  useEffect(() => {
    if (!ready || !tripId) {
      return;
    }
    let cancelled = false;
    achievementsService
      .get()
      .then((data) => {
        if (!cancelled) {
          setEarned(data.achievements.filter((a) => a.trip_id === tripId));
          useAchievementsStore.setState({data, error: null});
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ready, tripId]);

  if (earned.length === 0) {
    return null;
  }
  const xp = earned.reduce((sum, a) => sum + a.xp, 0);
  return (
    <Card style={{padding: 16, gap: 10}}>
      <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
        <AppText size={16} weight="black">
          🏆 Unlocked
        </AppText>
        <AppText size={15} weight="black" color={c.green}>
          ★ +{xp} XP
        </AppText>
      </View>
      {earned.map((a) => (
        <View key={a.id} style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
          <AchievementIcon category={a.category} size={40} />
          <View style={{flex: 1}}>
            <AppText size={15} weight="extrabold">
              {a.title}
            </AppText>
            <AppText size={12} weight="semibold" tone="secondary">
              {achievementDescription(a, units)}
            </AppText>
          </View>
          <AppText size={14} weight="black" color={c.green}>
            +{a.xp}
          </AppText>
        </View>
      ))}
    </Card>
  );
}
