import {useMemo, useState} from 'react';
import {View} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {getDb} from '../../db';
import {tripObd} from '../../db/obdRepos';
import {useUnits} from '../../hooks/useUnits';
import {formatMoney, fuelCost} from '../../obd/fuel';
import {economy, economyLabel, fuelVolume, temperature} from '../../obd/tiles';
import type {ObdSeries} from '../../obd/series';
import {usePreferencesStore} from '../../stores/preferencesStore';
import {useAppTheme} from '../../theme/ThemeProvider';
import {formatSpan} from '../../utils/format';
import {AppText} from '../AppText';
import {BentoTile} from '../BentoTile';
import {Card} from '../Card';
import {SectionTitle} from './SectionTitle';

const H = 96;
const PAD = 4;
/** Missing readings shorter than this are bridged: slow PIDs (coolant) are only read every few seconds. */
const GAP_S = 15;

/** Line paths for one series; a stretch without car data longer than `GAP_S` shows as a gap. */
export const gappedPath = (t: number[], ys: (number | null)[], width: number, height: number): string => {
  const values = ys.filter((y): y is number => y != null);
  if (values.length < 2 || t.length < 2) {
    return '';
  }
  const x0 = t[0];
  const x1 = t[t.length - 1];
  const top = Math.max(...values, 1);
  const sx = x1 > x0 ? (width - PAD * 2) / (x1 - x0) : 0;
  const sy = (height - PAD * 2) / top;
  let d = '';
  let lastT: number | null = null;
  ys.forEach((y, i) => {
    if (y == null) {
      return;
    }
    const x = Math.round((PAD + (t[i] - x0) * sx) * 10) / 10;
    const yy = Math.round((height - PAD - y * sy) * 10) / 10;
    d += `${lastT != null && t[i] - lastT <= GAP_S ? 'L' : 'M'}${x} ${yy}`;
    lastT = t[i];
  });
  return d;
};

function ObdChart({title, series, pick, color, peak}: {title: string; series: ObdSeries; pick: (s: ObdSeries) => (number | null)[]; color: string; peak: string}) {
  const [width, setWidth] = useState(0);
  const ys = pick(series);
  const d = width > 0 ? gappedPath(series.t, ys, width, H) : '';
  if (ys.every((y) => y == null)) {
    return null;
  }
  return (
    <Card style={{padding: 16, gap: 10}}>
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline'}}>
        <AppText size={14} weight="extrabold">
          {title}
        </AppText>
        <AppText size={13} weight="bold" tone="secondary">
          {peak}
        </AppText>
      </View>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{height: H}}>
        {d ? (
          <Svg width={width} height={H}>
            <Path d={d} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          </Svg>
        ) : null}
      </View>
    </Card>
  );
}

/**
 * Trip Detail's "Car" section (spec 2026-10-25, telemetry, section 5): what the OBD-II adapter saw
 * on this drive. Nothing at all for a drive without car data.
 */
export function CarSection({startTime}: {startTime: string}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const u = useUnits();
  const temperatureUnit = usePreferencesStore((s) => s.temperature);
  const price = usePreferencesStore((s) => s.fuelPrice);
  const mileage = usePreferencesStore((s) => s.mileageUnit);
  const currency = usePreferencesStore((s) => s.currency);
  const data = useMemo(() => {
    const db = getDb();
    return db ? tripObd(db, Date.parse(startTime)) : null;
  }, [startTime]);
  if (!data) {
    return null;
  }
  const {stats, series} = data;
  const tiles = [
    stats.fuelUsedL != null ? {label: 'Fuel used', ...fuelVolume(stats.fuelUsedL, u.units), icon: 'water' as const, color: c.cyan} : null,
    fuelCost(stats.fuelUsedL, price) != null ? {label: 'Fuel cost', value: formatMoney(fuelCost(stats.fuelUsedL, price) as number, currency), unit: '', icon: 'pricetag' as const, color: c.green} : null,
    stats.avgL100km != null ? {label: economyLabel(u.units, mileage), ...economy(stats.avgL100km, u.units, mileage), icon: 'leaf' as const, color: c.green} : null,
    stats.avgRpm != null ? {label: 'Average RPM', value: String(stats.avgRpm), unit: 'rpm', icon: 'speedometer' as const, color: c.accent} : null,
    stats.maxRpm != null ? {label: 'Highest RPM', value: String(Math.round(stats.maxRpm)), unit: 'rpm', icon: 'trending-up' as const, color: c.red} : null,
    stats.maxCoolantC != null ? {label: 'Hottest coolant', ...temperature(stats.maxCoolantC, temperatureUnit), icon: 'thermometer' as const, color: c.amber} : null,
    {label: 'Engine idling', value: formatSpan(stats.idleS), unit: '', icon: 'pause-circle' as const, color: c.textSecondary},
    stats.idleFuelL != null ? {label: 'Fuel idling', ...fuelVolume(stats.idleFuelL, u.units), icon: 'hourglass' as const, color: c.amber} : null,
    stats.coastShare != null ? {label: 'Coasting', value: String(Math.round(stats.coastShare * 100)), unit: '%', icon: 'leaf' as const, color: c.mint} : null,
    stats.highRpmS != null ? {label: 'High revs', value: formatSpan(stats.highRpmS), unit: '', icon: 'flame' as const, color: stats.highRpmS > 60 ? c.red : c.textSecondary} : null,
    stats.warmupS != null ? {label: 'Warm-up', value: stats.warmupS === 0 ? 'Warm start' : formatSpan(stats.warmupS), unit: '', icon: 'thermometer' as const, color: c.blue} : null,
  ].filter((t): t is NonNullable<typeof t> => t != null);

  return (
    <>
      <SectionTitle icon="hardware-chip" color={c.accent} title="Car" />
      <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.cardGap}}>
        {tiles.map((t) => (
          <BentoTile key={t.label} label={t.label} value={t.value} unit={t.unit} icon={t.icon} iconColor={t.color} compact style={{flexBasis: '48%', flexGrow: 1}} />
        ))}
      </View>
      <ObdChart title="RPM" series={series} pick={(s) => s.rpm} color={c.accent} peak={stats.maxRpm != null ? `Peak ${Math.round(stats.maxRpm)}` : ''} />
      <ObdChart
        title="Coolant"
        series={series}
        pick={(s) => s.coolant}
        color={c.amber}
        peak={stats.maxCoolantC != null ? `Peak ${temperature(stats.maxCoolantC, temperatureUnit).value}${temperature(0, temperatureUnit).unit}` : ''}
      />
      {stats.coverage < 0.9 ? (
        <AppText size={13} weight="semibold" tone="tertiary" style={{textAlign: 'center'}}>
          Car data for {Math.round(stats.coverage * 100)}% of this drive
        </AppText>
      ) : null}
    </>
  );
}
