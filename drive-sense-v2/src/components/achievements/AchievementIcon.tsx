import {Ionicons} from '@expo/vector-icons';
import {View} from 'react-native';
import type {AchievementCategory} from '../../services/achievementsService';
import {withAlpha} from '../../theme/color';
import type {AppTheme} from '../../theme/theme';
import {useAppTheme} from '../../theme/ThemeProvider';

type IconName = keyof typeof Ionicons.glyphMap;

export const categoryStyle = (category: AchievementCategory, c: AppTheme['colors']): {icon: IconName; color: string} =>
  ({
    distance: {icon: 'map', color: c.cyan},
    drives: {icon: 'car-sport', color: c.blue},
    time: {icon: 'time', color: c.green},
    streak: {icon: 'flame', color: c.accent},
    night: {icon: 'moon', color: c.purple},
    gforce: {icon: 'magnet', color: c.amber},
    smooth: {icon: 'leaf', color: c.mint},
  })[category] as {icon: IconName; color: string};

/** The category glyph in a tinted circle; grey while the achievement is locked. */
export function AchievementIcon({category, locked, size = 52}: {category: AchievementCategory; locked?: boolean; size?: number}) {
  const c = useAppTheme().colors;
  const {icon, color} = categoryStyle(category, c);
  return (
    <View style={{width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: locked ? c.separator : withAlpha(color, 0.16)}}>
      <Ionicons name={icon} size={size * 0.44} color={locked ? c.textTertiary : color} />
    </View>
  );
}
