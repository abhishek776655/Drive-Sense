import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {useEffect, useState} from 'react';
import {Pressable, RefreshControl, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AppText} from '../components/AppText';
import {Card} from '../components/Card';
import {OptionSheet} from '../components/logbook/OptionSheet';
import {DateRangeSheet} from '../components/stats/DateRangeSheet';
import {DrivingEventsCard} from '../components/stats/DrivingEventsCard';
import {PlacesCard} from '../components/stats/PlacesCard';
import {WhenYouDriveCard} from '../components/stats/WhenYouDriveCard';
import {DistanceByDayCard, PeakHoursCard} from '../components/stats/DayAndHourCards';
import {RecordsCard} from '../components/stats/RecordsCard';
import {SpeedDistributionCard} from '../components/stats/SpeedDistributionCard';
import {StatsChips} from '../components/stats/StatsChips';
import {StatsHeroCard} from '../components/stats/StatsHeroCard';
import {CarStatsCard} from '../components/stats/CarStatsCard';
import {StatsTiles} from '../components/stats/StatsTiles';
import {StreaksCard} from '../components/stats/StreaksCard';
import {TimeAtSpeedDonutCard} from '../components/stats/TimeAtSpeedDonutCard';
import {TrendCard} from '../components/stats/TrendCard';
import {StickyHeaderScroll} from '../components/StickyHeaderScroll';
import {useCarStats} from '../hooks/useCarStats';
import {useStatsStore} from '../stores/statsStore';
import {useVehicleStore} from '../stores/vehicleStore';
import {useAppTheme} from '../theme/ThemeProvider';
import {rangeLabel} from '../utils/calendar';
import {CUSTOM_EMPTY, PERIOD_TITLES, STATS_PERIODS} from '../utils/stats';
import {ActionButton} from '../components/ActionButton';

const ALL_VEHICLES = 'all';

/** Home's section label, spaced for a column that already has a gap between items. */
function SectionLabel({children}: {children: string}) {
  return (
    <AppText size={12} weight="extrabold" tone="secondary" style={{letterSpacing: 0.8, marginTop: 14, marginBottom: -2, marginLeft: 4}}>
      {children}
    </AppText>
  );
}

function Skeleton() {
  const c = useAppTheme().colors;
  return (
    <>
      <View style={{height: 172, borderRadius: 34, backgroundColor: c.accentTint}} />
      {[200, 260].map((height) => (
        <Card key={height} style={{height, opacity: 0.6, backgroundColor: c.card}} />
      ))}
    </>
  );
}

/**
 * All Stats: Odo's statistics as one page of Rovy cards. The period and vehicle chips set what
 * every card covers; streaks alone are all-time.
 */
export default function AllStatsScreen() {
  const theme = useAppTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const {period, vehicleId, range, data, status, error, load, setFilters} = useStatsStore();
  const car = useCarStats({period, range, vehicleId});
  const vehicles = useVehicleStore((s) => s.vehicles);
  const loadVehicles = useVehicleStore((s) => s.load);
  const [vehicleSheet, setVehicleSheet] = useState(false);
  const [dateSheet, setDateSheet] = useState(false);
  // Opened from Home it is a sheet; opened from a link with nothing beneath, it is full screen.
  const [canClose] = useState(() => router.canGoBack());

  useEffect(() => {
    void load();
    if (vehicles.length === 0) {
      void loadVehicles();
    }
    // Loads once on open; the chips reload through setFilters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vehicleLabel = vehicles.find((v) => v.id === vehicleId)?.display_name ?? 'All vehicles';
  const customLabel = range ? rangeLabel(range) : null;
  const periodTitle = period === 'custom' ? (customLabel ?? 'Custom') : PERIOD_TITLES[period];
  const emptyText = period === 'custom' ? CUSTOM_EMPTY : (STATS_PERIODS.find((p) => p.value === period) ?? STATS_PERIODS[1]).empty;
  const openTrip = (id: string) => router.push(`/trip/${id}`);
  const empty = data != null && data.summary.trip_count === 0;

  return (
    <View style={{flex: 1}}>
      <StickyHeaderScroll
        kicker="All"
        title="Stats"
        onBack={() => router.back()}
        sheet={canClose}
        contentContainerStyle={{paddingBottom: insets.bottom + 32, gap: theme.space.cardGap}}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} tintColor={c.accent} />}>
        <StatsChips
          period={period}
          customLabel={customLabel}
          vehicleLabel={vehicleLabel}
          onPeriod={(p) => void setFilters({period: p})}
          onCustom={() => setDateSheet(true)}
          onVehicle={() => setVehicleSheet(true)}
        />

        {status === 'error' ? (
          <Pressable accessibilityRole="button" onPress={() => void load()} style={{backgroundColor: c.accentTint, borderRadius: 16, padding: 12}}>
            <AppText size={13} weight="bold" tone="accent">
              {error} Tap to retry.
            </AppText>
          </Pressable>
        ) : null}

        {data == null ? (
          status === 'error' ? null : <Skeleton />
        ) : empty ? (
          <Card style={{alignItems: 'center', gap: 12, paddingVertical: 28, paddingHorizontal: 20}}>
            <Ionicons name="stats-chart" size={30} color={c.textTertiary} />
            <AppText size={15} weight="bold" tone="secondary" style={{textAlign: 'center'}}>
              {emptyText}
              {vehicleId ? ` with ${vehicleLabel}` : ''}
            </AppText>
            {period !== 'all' ? (
              <ActionButton variant="soft" label="Show all time" onPress={() => void setFilters({period: 'all'})} height={40} size={14} />
            ) : null}
          </Card>
        ) : (
          // Dimmed while a new period loads, so the old numbers never pass for the new ones.
          <View style={{gap: theme.space.cardGap, opacity: status === 'loading' ? 0.5 : 1}}>
            <StatsHeroCard summary={data.summary} title={periodTitle} />
            <StatsTiles data={data} />
            <SectionLabel>TRENDS</SectionLabel>
            <TrendCard trend={data.trend} period={data.period} periodTitle={periodTitle} />
            {data.events ? (
              <>
                <SectionLabel>DRIVING EVENTS</SectionLabel>
                <DrivingEventsCard events={data.events} />
              </>
            ) : null}
            {car ? (
              <>
                <SectionLabel>CAR</SectionLabel>
                <CarStatsCard totals={car} tripCount={data.summary.trip_count} />
              </>
            ) : null}
            <SectionLabel>SPEED</SectionLabel>
            <SpeedDistributionCard bands={data.speed_distribution} />
            <TimeAtSpeedDonutCard bands={data.time_at_speed} />
            {data.time_of_day.length > 0 ? (
              <>
                <SectionLabel>WHEN YOU DRIVE</SectionLabel>
                <WhenYouDriveCard parts={data.time_of_day} days={data.weekdays} />
              </>
            ) : null}
            {/* Over a month, a year or a custom range there is enough to see a pattern by day and hour. */}
            {period !== 'week' && data.summary.trip_count > 0 ? (
              <>
                <SectionLabel>DISTANCE BY DAY</SectionLabel>
                <DistanceByDayCard days={data.weekdays} />
                {data.hours?.length ? (
                  <>
                    <SectionLabel>PEAK DRIVING HOURS</SectionLabel>
                    <PeakHoursCard hours={data.hours} />
                  </>
                ) : null}
              </>
            ) : null}
            <SectionLabel>RECORDS</SectionLabel>
            <RecordsCard records={data.records} topDays={data.top_days} onOpenTrip={openTrip} />
            <SectionLabel>STREAKS · ALL TIME</SectionLabel>
            <StreaksCard streaks={data.streaks} />
            {data.places.length > 0 ? (
              <>
                <SectionLabel>MOST VISITED</SectionLabel>
                <PlacesCard places={data.places} />
              </>
            ) : null}
          </View>
        )}
      </StickyHeaderScroll>

      {dateSheet ? (
        <DateRangeSheet visible range={range} onApply={(picked) => void setFilters({period: 'custom', range: picked})} onClose={() => setDateSheet(false)} />
      ) : null}
      <OptionSheet
        visible={vehicleSheet}
        title="Vehicle"
        options={[{value: ALL_VEHICLES, label: 'All vehicles'}, ...vehicles.map((v) => ({value: v.id, label: v.display_name}))]}
        value={vehicleId ?? ALL_VEHICLES}
        onPick={(value) => void setFilters({vehicleId: value === ALL_VEHICLES ? null : value})}
        onClose={() => setVehicleSheet(false)}
      />
    </View>
  );
}
