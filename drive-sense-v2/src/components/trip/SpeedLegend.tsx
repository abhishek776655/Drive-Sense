import {LinearGradient} from 'expo-linear-gradient';
import {View} from 'react-native';
import {useUnits} from '../../hooks/useUnits';
import {useAppTheme} from '../../theme/ThemeProvider';
import {speedScaleStops} from '../../utils/speedColor';
import {kmhInUnits} from '../../utils/units';
import {AppText} from '../AppText';

/** "0 ▬▬▬ 100+ km/h" (or "62+ mph") chip over the map: the route colour scale. */
export function SpeedLegend() {
  const theme = useAppTheme();
  const u = useUnits();
  const colors = speedScaleStops(theme.colors).map((s) => s.color) as [string, string, ...string[]];
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99, backgroundColor: theme.colors.card}}>
      <AppText size={11} weight="extrabold">
        0
      </AppText>
      <LinearGradient colors={colors} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={{width: 64, height: 6, borderRadius: 3}} />
      <AppText size={11} weight="extrabold">
        {kmhInUnits(100, u.units)}+ {u.speedUnit}
      </AppText>
    </View>
  );
}
