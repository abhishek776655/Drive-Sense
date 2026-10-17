import {View} from 'react-native';
import type {StatsOverview} from '../../services/statsService';
import {useAppTheme} from '../../theme/ThemeProvider';
import {BentoTile} from '../BentoTile';

/** Current and best run of days with a drive, as Home's Streak tile; always all-time. */
export function StreaksCard({streaks}: {streaks: StatsOverview['streaks']}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const unit = (n: number) => (n === 1 ? 'day' : 'days');
  return (
    <View style={{flexDirection: 'row', gap: theme.space.cardGap}}>
      <BentoTile label="Current" value={String(streaks.current_days)} unit={unit(streaks.current_days)} icon="flame" iconColor={c.red} />
      <BentoTile label="Best" value={String(streaks.best_days)} unit={unit(streaks.best_days)} icon="trophy" iconColor={c.amber} />
    </View>
  );
}
