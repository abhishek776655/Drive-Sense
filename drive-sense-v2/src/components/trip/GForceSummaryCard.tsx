import {Ionicons} from '@expo/vector-icons';
import {View} from 'react-native';
import {useAppTheme} from '../../theme/ThemeProvider';
import {DASH, formatG} from '../../utils/format';
import {AppText} from '../AppText';
import {Card} from '../Card';

function Part({icon, color, value, label}: {icon: keyof typeof Ionicons.glyphMap; color: string; value: string; label: string}) {
  const c = useAppTheme().colors;
  return (
    <View style={{flex: 1, alignItems: 'center', gap: 2, paddingVertical: 10, borderRadius: 16, backgroundColor: c.control}}>
      <Ionicons name={icon} size={15} color={color} />
      <AppText size={17} weight="black">
        {value}
      </AppText>
      <AppText size={11} weight="bold" tone="secondary">
        {label}
      </AppText>
    </View>
  );
}

/** Rovy-style G-Force card: the trip's biggest G, then acceleration and braking peaks, and the hardest corner when the phone measured it. */
export function GForceSummaryCard({maxG, approximate, accelG, brakeG, corner}: {maxG: number | null; approximate: boolean; accelG: number | null; brakeG: number | null; corner?: number | null}) {
  const c = useAppTheme().colors;
  return (
    <Card style={{padding: 16, gap: 12}}>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
        <Ionicons name="speedometer-outline" size={16} color={c.purple} />
        <AppText size={13} weight="bold" tone="secondary">
          G-Force
        </AppText>
      </View>
      <View style={{alignItems: 'center'}}>
        <AppText size={40} weight="black" style={{lineHeight: 46}}>
          {maxG != null ? `${approximate ? '≈' : ''}${formatG(maxG)}` : DASH}
          <AppText size={15} weight="bold" tone="secondary">
            {' '}G
          </AppText>
        </AppText>
        <AppText size={12} weight="bold" tone="secondary">
          Highest on this drive
        </AppText>
      </View>
      <View style={{flexDirection: 'row', gap: 8}}>
        <Part icon="arrow-up" color={c.green} value={accelG != null ? formatG(accelG) : DASH} label="Acceleration" />
        <Part icon="arrow-down" color={c.red} value={brakeG != null ? formatG(brakeG) : DASH} label="Braking" />
        {corner != null ? <Part icon="return-up-forward" color={c.cyan} value={formatG(corner)} label="Hardest corner" /> : null}
      </View>
    </Card>
  );
}
