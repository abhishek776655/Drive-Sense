import {Ionicons} from '@expo/vector-icons';
import {Pressable} from 'react-native';
import type {AchievementsOverview} from '../services/achievementsService';
import {useAppTheme} from '../theme/ThemeProvider';
import {levelProgress} from '../utils/achievements';
import {HalfTile} from './HalfTile';
import {ProgressRing} from './ProgressRing';

/** Home: the driver's level and title, with the way to the next level as a ring; opens Achievements. */
export function LevelTile({data, onPress}: {data: AchievementsOverview; onPress: () => void}) {
  const c = useAppTheme().colors;
  const {fraction} = levelProgress(data);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Level ${data.level}, ${data.title}. Achievements`}
      onPress={onPress}
      style={({pressed}) => ({flexDirection: 'row', opacity: pressed ? 0.8 : 1})}>
      <HalfTile
        label={`Level ${data.level}`}
        value={data.title}
        right={
          <ProgressRing share={fraction} color={c.green} label={`${Math.round(fraction * 100)}% of the way to the next level`}>
            <Ionicons name="trophy" size={16} color={c.amber} />
          </ProgressRing>
        }
      />
    </Pressable>
  );
}
