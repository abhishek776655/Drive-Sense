import {Ionicons} from '@expo/vector-icons';
import {View} from 'react-native';
import {useDriveFuel} from '../../hooks/useDriveMileage';
import {useUnits} from '../../hooks/useUnits';
import {formatMoney, fuelCost} from '../../obd/fuel';
import {economy, economyLabel, fuelVolume} from '../../obd/tiles';
import {usePreferencesStore} from '../../stores/preferencesStore';
import {useRecordingStore} from '../../stores/recordingStore';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {Card} from '../Card';

function Stat({label, value, unit}: {label: string; value: string; unit?: string}) {
  return (
    <View style={{flex: 1, gap: 2}}>
      <AppText size={12} weight="bold" tone="secondary">
        {label}
      </AppText>
      <View style={{flexDirection: 'row', alignItems: 'baseline', gap: 4}}>
        <AppText size={22} weight="black" style={{fontVariant: ['tabular-nums']}}>
          {value}
        </AppText>
        {unit ? (
          <AppText size={12} weight="bold" tone="secondary">
            {unit}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

/** Mileage, fuel and cost of the drive being recorded; nothing when no drive is recording. */
export function ThisDriveCard() {
  const c = useAppTheme().colors;
  const u = useUnits();
  const mileage = usePreferencesStore((s) => s.mileageUnit);
  const price = usePreferencesStore((s) => s.fuelPrice);
  const currency = usePreferencesStore((s) => s.currency);
  const recording = useRecordingStore((s) => s.status === 'recording');
  const now = useDriveFuel();
  if (!recording) {
    return null;
  }

  const econ = now?.l100km != null ? economy(now.l100km, u.units, mileage) : null;
  const fuel = now?.fuelUsedL != null ? fuelVolume(now.fuelUsedL, u.units) : null;
  const cost = fuelCost(now?.fuelUsedL, price);

  return (
    <Card style={{padding: 16, gap: 12}}>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
        <Ionicons name="radio-button-on" size={16} color={c.red} />
        <AppText size={15} weight="extrabold" style={{flex: 1}}>
          This drive
        </AppText>
      </View>
      {econ || fuel ? (
        <View style={{flexDirection: 'row', gap: 12}}>
          <Stat label={economyLabel(u.units, mileage)} value={econ?.value ?? '—'} unit={econ?.unit} />
          <Stat label="Fuel used" value={fuel?.value ?? '—'} unit={fuel?.unit} />
          {cost != null ? <Stat label="Cost" value={formatMoney(cost, currency)} /> : null}
        </View>
      ) : (
        <AppText size={13} weight="semibold" tone="secondary">
          Mileage shows after the first few hundred metres.
        </AppText>
      )}
    </Card>
  );
}
