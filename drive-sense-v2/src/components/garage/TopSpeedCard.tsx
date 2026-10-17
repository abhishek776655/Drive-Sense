import {Ionicons} from '@expo/vector-icons';
import {View} from 'react-native';
import {useUnits} from '../../hooks/useUnits';
import {useAppTheme} from '../../theme/ThemeProvider';
import {DASH} from '../../utils/format';
import {AppText} from '../AppText';
import {RollingNumber} from '../RollingNumber';

/** Full-width orange card: the vehicle's top speed, rolling when you switch vehicles. */
export function TopSpeedCard({topSpeedMps}: {topSpeedMps: number | null | undefined}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const u = useUnits();
  const speed = u.speedValue(topSpeedMps);
  return (
    <View
      style={{
        backgroundColor: c.accent,
        borderRadius: 34,
        height: 112,
        paddingHorizontal: 24,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: c.accent,
        shadowOpacity: theme.scheme === 'light' ? 0.3 : 0.2,
        shadowRadius: 14,
        shadowOffset: {width: 0, height: 6},
      }}>
      <View style={{flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 10}}>
        {speed != null ? (
          <RollingNumber value={speed} size={60} lineHeight={70} weight="black" color={c.onAccent} />
        ) : (
          <AppText size={60} weight="black" tone="onAccent" style={{lineHeight: 70}}>
            {DASH}
          </AppText>
        )}
        <AppText size={17} weight="extrabold" tone="onAccent" style={{opacity: 0.7, marginBottom: 12}}>
          {u.speedUnit}
        </AppText>
      </View>
      <View style={{alignItems: 'flex-end', alignSelf: 'flex-end', paddingBottom: 18, gap: 4}}>
        <Ionicons name="flame" size={22} color={c.onAccent} style={{opacity: 0.55, marginRight: 4}} />
        <AppText size={12} weight="extrabold" tone="onAccent" style={{opacity: 0.6}}>
          Top speed
        </AppText>
      </View>
    </View>
  );
}
