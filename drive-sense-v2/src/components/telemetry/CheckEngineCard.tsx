import {Ionicons} from '@expo/vector-icons';
import {View} from 'react-native';
import {describeDtc} from '../../obd/dtc';
import {withAlpha} from '../../theme/color';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {Card} from '../Card';

/**
 * The check-engine light with what it is about: each stored trouble code, the system it belongs to
 * and its meaning in plain words. Before the codes arrive it still says how many the car reports.
 */
export function CheckEngineCard({codes, count}: {codes: string[]; count: number}) {
  const c = useAppTheme().colors;
  const shown = codes.map(describeDtc);
  const total = Math.max(count, shown.length);
  return (
    <Card style={{padding: 16, gap: 14, borderWidth: 1, borderColor: withAlpha(c.amber, 0.35)}}>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
        <View style={{width: 40, height: 40, borderRadius: 20, backgroundColor: withAlpha(c.amber, 0.16), alignItems: 'center', justifyContent: 'center'}}>
          <Ionicons name="warning" size={21} color={c.amber} />
        </View>
        <View style={{flex: 1}}>
          <AppText size={16} weight="black">
            Check engine light on
          </AppText>
          <AppText size={13} weight="semibold" tone="secondary">
            {total} trouble {total === 1 ? 'code' : 'codes'} stored
          </AppText>
        </View>
      </View>
      {shown.map((d) => (
        <View key={d.code} style={{flexDirection: 'row', gap: 12, alignItems: 'flex-start'}} accessible accessibilityLabel={`${d.code}, ${d.systemName}: ${d.meaning}`}>
          <View style={{width: 34, height: 34, borderRadius: 10, backgroundColor: c.control, alignItems: 'center', justifyContent: 'center'}}>
            <Ionicons name={d.icon} size={17} color={c.amber} />
          </View>
          <View style={{flex: 1, gap: 2}}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
              <AppText size={15} weight="black" style={{fontVariant: ['tabular-nums'], letterSpacing: 0.5}}>
                {d.code}
              </AppText>
              <AppText size={12} weight="bold" tone="secondary">
                {d.systemName}
              </AppText>
            </View>
            <AppText size={14} weight="semibold">
              {d.meaning}
            </AppText>
          </View>
        </View>
      ))}
    </Card>
  );
}
