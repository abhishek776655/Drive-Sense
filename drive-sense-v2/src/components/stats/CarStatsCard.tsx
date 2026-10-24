import {View} from 'react-native';
import {useUnits} from '../../hooks/useUnits';
import {formatMoney, fuelCost} from '../../obd/fuel';
import {economy, economyLabel, fuelVolume, temperature} from '../../obd/tiles';
import type {CarTotals} from '../../stats/carStats';
import {usePreferencesStore} from '../../stores/preferencesStore';
import {useAppTheme} from '../../theme/ThemeProvider';
import {formatSpan} from '../../utils/format';
import {AppText} from '../AppText';
import {BentoTile} from '../BentoTile';

type Tile = {label: string; value: string; unit?: string; icon: React.ComponentProps<typeof BentoTile>['icon']; color: string};

/**
 * Car numbers from the OBD-II adapter (spec 2026-10-25, telemetry) as bento tiles, two to a row,
 * for Home (all time) and All stats (the chosen period). Values the car never reported are left out.
 */
export function CarStatsCard({totals, tripCount}: {totals: CarTotals; tripCount?: number}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const u = useUnits();
  const temperatureUnit = usePreferencesStore((s) => s.temperature);
  const price = usePreferencesStore((s) => s.fuelPrice);
  const mileage = usePreferencesStore((s) => s.mileageUnit);
  const currency = usePreferencesStore((s) => s.currency);
  const gap = theme.space.cardGap;
  const tiles: Tile[] = [];
  if (totals.fuelL != null) {
    tiles.push({label: 'Fuel used', ...fuelVolume(totals.fuelL, u.units), icon: 'water', color: c.cyan});
  }
  const cost = fuelCost(totals.fuelL, price);
  if (cost != null) {
    tiles.push({label: 'Fuel cost', value: formatMoney(cost, currency), icon: 'pricetag', color: c.green});
  }
  if (totals.avgL100km != null) {
    tiles.push({label: `Avg ${economyLabel(u.units, mileage).toLowerCase()}`, ...economy(totals.avgL100km, u.units, mileage), icon: 'leaf', color: c.green});
  }
  if (totals.avgRpm != null) {
    tiles.push({label: 'Avg RPM', value: String(totals.avgRpm), unit: 'rpm', icon: 'speedometer', color: c.accent});
  }
  if (totals.maxRpm != null) {
    tiles.push({label: 'Highest RPM', value: String(Math.round(totals.maxRpm)), unit: 'rpm', icon: 'trending-up', color: c.red});
  }
  if (totals.maxCoolantC != null) {
    tiles.push({label: 'Hottest coolant', ...temperature(totals.maxCoolantC, temperatureUnit), icon: 'thermometer', color: c.amber});
  }
  tiles.push({label: 'Engine idling', value: formatSpan(totals.idleS), icon: 'pause-circle', color: c.textSecondary});
  if (totals.idleFuelL != null) {
    tiles.push({label: 'Fuel idling', ...fuelVolume(totals.idleFuelL, u.units), icon: 'hourglass', color: c.amber});
  }
  if (totals.coastShare != null) {
    tiles.push({label: 'Coasting', value: String(Math.round(totals.coastShare * 100)), unit: '%', icon: 'leaf', color: c.mint});
  }
  if (totals.highRpmS != null) {
    tiles.push({label: 'High revs', value: formatSpan(totals.highRpmS), icon: 'flame', color: c.red});
  }
  if (totals.avgWarmupS != null) {
    tiles.push({label: 'Avg warm-up', value: formatSpan(totals.avgWarmupS), icon: 'thermometer', color: c.blue});
  }
  // With one drive the best is just the average.
  if (totals.bestL100km != null && totals.drives > 1) {
    tiles.push({label: 'Best drive', ...economy(totals.bestL100km, u.units, mileage), icon: 'ribbon', color: c.mint});
  }

  const rows: Tile[][] = [];
  for (let i = 0; i < tiles.length; i += 2) {
    rows.push(tiles.slice(i, i + 2));
  }
  const share = tripCount != null && tripCount > totals.drives ? `From ${totals.drives} of ${tripCount} drives with car data` : null;
  return (
    <View style={{gap}}>
      {rows.map((row) => (
        <View key={row[0].label} style={{flexDirection: 'row', gap}}>
          {row.map((t) => (
            <BentoTile key={t.label} label={t.label} value={t.value} unit={t.unit} icon={t.icon} iconColor={t.color} />
          ))}
        </View>
      ))}
      {share ? (
        <AppText size={12} weight="semibold" tone="tertiary" style={{textAlign: 'center'}}>
          {share}
        </AppText>
      ) : null}
    </View>
  );
}
