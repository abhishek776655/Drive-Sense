import {Ionicons} from '@expo/vector-icons';
import {ScrollView} from 'react-native';
import type {StatsPeriod} from '../../services/statsService';
import {useAppTheme} from '../../theme/ThemeProvider';
import {STATS_PERIODS} from '../../utils/stats';
import {AppText} from '../AppText';
import {GlassButton} from '../GlassButton';

interface StatsChipsProps {
  period: StatsPeriod;
  /** Shown on the calendar chip when a custom range or month is picked. */
  customLabel: string | null;
  vehicleLabel: string;
  onPeriod: (period: StatsPeriod) => void;
  onCustom: () => void;
  onVehicle: () => void;
}

/** Week · Month · Year · All, a calendar chip, then the vehicle chip; they set what every card covers. */
export function StatsChips({period, customLabel, vehicleLabel, onPeriod, onCustom, onVehicle}: StatsChipsProps) {
  const c = useAppTheme().colors;
  return (
    // Extra vertical room so the glass chips' shadows are not clipped by the scroll view.
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{marginHorizontal: -16, marginVertical: -10}}
      contentContainerStyle={{paddingHorizontal: 16, paddingVertical: 16, gap: 8}}>
      {STATS_PERIODS.map((p) => {
        const on = p.value === period;
        return (
          <GlassButton
            key={p.value}
            accessibilityLabel={p.label}
            accessibilityState={{selected: on}}
            fill={on ? c.accent : undefined}
            onPress={() => onPeriod(p.value)}
            style={{height: 34, paddingHorizontal: 16}}>
            <AppText size={13} weight="extrabold" color={on ? c.onAccent : c.textPrimary}>
              {p.label}
            </AppText>
          </GlassButton>
        );
      })}
      <GlassButton
        accessibilityLabel={customLabel ? `${customLabel}, change dates` : 'Pick a month or dates'}
        accessibilityState={{selected: period === 'custom'}}
        fill={period === 'custom' ? c.accent : undefined}
        onPress={onCustom}
        style={{flexDirection: 'row', gap: 6, height: 34, paddingHorizontal: 12}}>
        <Ionicons name="calendar" size={14} color={period === 'custom' ? c.onAccent : c.accent} />
        {period === 'custom' && customLabel ? (
          <AppText size={13} weight="extrabold" color={c.onAccent} numberOfLines={1}>
            {customLabel}
          </AppText>
        ) : null}
      </GlassButton>
      <GlassButton accessibilityLabel={`${vehicleLabel}, change vehicle`} onPress={onVehicle} style={{flexDirection: 'row', gap: 5, height: 34, paddingHorizontal: 12}}>
        <Ionicons name="car-sport" size={14} color={c.accent} />
        <AppText size={13} weight="extrabold" numberOfLines={1} style={{maxWidth: 150}}>
          {vehicleLabel}
        </AppText>
        <Ionicons name="chevron-down" size={13} color={c.textSecondary} />
      </GlassButton>
    </ScrollView>
  );
}
