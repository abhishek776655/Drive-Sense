import {Ionicons} from '@expo/vector-icons';
import {useEffect, useState} from 'react';
import {View} from 'react-native';
import {getDb} from '../../db';
import {latestTripObd} from '../../db/obdRepos';
import {useDriveFuel} from '../../hooks/useDriveMileage';
import {useUnits} from '../../hooks/useUnits';
import {formatMoney, fuelCost} from '../../obd/fuel';
import {economy, economyLabel, fuelVolume} from '../../obd/tiles';
import {usePreferencesStore} from '../../stores/preferencesStore';
import {useRecordingStore} from '../../stores/recordingStore';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {Card} from '../Card';

/** The last finished drive with car data, read once when not recording. */
function useLastDrive(recording: boolean) {
  const [last, setLast] = useState<ReturnType<typeof latestTripObd>>(null);
  useEffect(() => {
    if (recording) {
      return;
    }
    const id = setTimeout(() => {
      const db = getDb();
      try {
        setLast(db ? latestTripObd(db) : null);
      } catch {
        setLast(null);
      }
    }, 0);
    return () => clearTimeout(id);
  }, [recording]);
  return last;
}

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

/**
 * Mileage, fuel and cost for this drive while recording; otherwise the last drive's, labelled so.
 * Says how to get it when there is neither.
 */
export function ThisDriveCard() {
  const c = useAppTheme().colors;
  const u = useUnits();
  const mileage = usePreferencesStore((s) => s.mileageUnit);
  const price = usePreferencesStore((s) => s.fuelPrice);
  const currency = usePreferencesStore((s) => s.currency);
  const recording = useRecordingStore((s) => s.status === 'recording');
  const now = useDriveFuel();
  const last = useLastDrive(recording);

  const source = recording ? now : last ? {l100km: last.stats.avgL100km, fuelUsedL: last.stats.fuelUsedL} : null;
  const title = recording ? 'This drive' : last ? 'Last drive' : 'This drive';
  const when = !recording && last ? new Date(last.startedAt).toLocaleDateString([], {day: 'numeric', month: 'short'}) : null;
  const econ = source?.l100km != null ? economy(source.l100km, u.units, mileage) : null;
  const fuel = source?.fuelUsedL != null ? fuelVolume(source.fuelUsedL, u.units) : null;
  const cost = fuelCost(source?.fuelUsedL, price);

  return (
    <Card style={{padding: 16, gap: 12}}>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
        <Ionicons name={recording ? 'radio-button-on' : 'time'} size={16} color={recording ? c.red : c.textTertiary} />
        <AppText size={15} weight="extrabold" style={{flex: 1}}>
          {title}
        </AppText>
        {when ? (
          <AppText size={13} weight="bold" tone="secondary">
            {when}
          </AppText>
        ) : null}
      </View>
      {source ? (
        <View style={{flexDirection: 'row', gap: 12}}>
          <Stat label={economyLabel(u.units, mileage)} value={econ?.value ?? '—'} unit={econ?.unit} />
          <Stat label="Fuel used" value={fuel?.value ?? '—'} unit={fuel?.unit} />
          {cost != null ? <Stat label="Cost" value={formatMoney(cost, currency)} /> : null}
        </View>
      ) : (
        <AppText size={13} weight="semibold" tone="secondary">
          {recording ? 'Mileage shows after the first few hundred metres.' : 'Start a drive to see its mileage and fuel here.'}
        </AppText>
      )}
    </Card>
  );
}
