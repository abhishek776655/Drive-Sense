import {View} from 'react-native';
import {useUnits} from '../../hooks/useUnits';
import type {StatsOverview} from '../../services/statsService';
import {useAppTheme} from '../../theme/ThemeProvider';
import {formatDuration, formatMeters} from '../../utils/format';
import {kmhInUnits} from '../../utils/units';
import {BentoTile} from '../BentoTile';

/** The rest of the summary as Home's bento tiles, two to a row. */
export function StatsTiles({data}: {data: StatsOverview}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const u = useUnits();
  const gap = theme.space.cardGap;
  const {summary, speeding} = data;
  const known = (s: string) => (s === '–' ? undefined : s);
  const avgDrive = u.distance(summary.avg_distance_meters);
  const avgSpeed = u.speed(summary.avg_speed_mps);
  const longest = u.distance(summary.longest_distance_meters);
  const sharePct = speeding?.share != null && speeding.seconds > 0 ? `${Math.max(1, Math.round(speeding.share * 100))}%` : undefined;
  return (
    <View style={{gap}}>
      <View style={{flexDirection: 'row', gap}}>
        <BentoTile label="Avg Speed" value={avgSpeed} unit={known(avgSpeed) && u.speedUnit} icon="speedometer" iconColor={c.accent} />
        <BentoTile label="Avg Drive" value={avgDrive} unit={known(avgDrive) && u.distanceUnit} icon="git-commit" iconColor={c.mint} />
      </View>
      <View style={{flexDirection: 'row', gap}}>
        <BentoTile label="Longest" value={longest} unit={known(longest) && u.distanceUnit} icon="flag" iconColor={c.red} />
        <BentoTile label="Avg Time" value={formatDuration(summary.avg_duration_seconds)} icon="timer" iconColor={c.purple} />
      </View>
      <View style={{flexDirection: 'row', gap}}>
        <BentoTile label="Moving" value={formatDuration(summary.moving_seconds)} icon="play-circle" iconColor={c.green} />
        <BentoTile label="Idle" value={formatDuration(summary.idle_seconds)} icon="pause-circle" iconColor={c.amber} />
      </View>
      <View style={{flexDirection: 'row', gap}}>
        {/* Moving time above the Settings speed-alert limit. */}
        <BentoTile
          label={speeding ? `Over ${kmhInUnits(speeding.limit_kmh, u.units)} ${u.speedUnit}` : 'Over limit'}
          value={formatDuration(speeding?.seconds ?? null)}
          unit={sharePct}
          icon="warning"
          iconColor={speeding && speeding.seconds > 0 ? c.red : c.green}
        />
        <BentoTile label="Climb" value={formatMeters(data.elevation_gain_m)} unit={data.elevation_gain_m != null ? 'm' : undefined} icon="trending-up" iconColor={c.teal} />
      </View>
    </View>
  );
}
