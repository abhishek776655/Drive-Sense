import {View} from 'react-native';
import {useUnits} from '../../hooks/useUnits';
import {useAppTheme} from '../../theme/ThemeProvider';
import {formatDuration} from '../../utils/format';
import type {MonthGroup} from '../../utils/logbook';
import {AppText} from '../AppText';

/** "October 2026 (12)" with the month's distance, time and top speed underneath (Odo). */
export function MonthHeader({group}: {group: MonthGroup}) {
  const c = useAppTheme().colors;
  const u = useUnits();
  return (
    <View style={{marginTop: 18, marginBottom: 2, marginHorizontal: 4, gap: 2}}>
      <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
        <AppText size={19} weight="extrabold" tone="secondary">
          {group.title}
        </AppText>
        <View style={{minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: c.control}}>
          <AppText size={12} weight="black" tone="secondary">
            {group.items.length}
          </AppText>
        </View>
      </View>
      <AppText size={12} weight="semibold" tone="tertiary">
        {u.distance(group.distanceM)} {u.distanceUnit} · {formatDuration(group.durationS)}
        {group.topMps != null ? ` · top ${u.speed(group.topMps)} ${u.speedUnit}` : ''}
      </AppText>
    </View>
  );
}
