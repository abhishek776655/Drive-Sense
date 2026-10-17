import {Ionicons} from '@expo/vector-icons';
import {router, useFocusEffect} from 'expo-router';
import {useCallback, useState} from 'react';
import {ActivityIndicator, Alert, Pressable, RefreshControl, View} from 'react-native';
import {AppText} from '../../components/AppText';
import {Card} from '../../components/Card';
import {FilterSheet} from '../../components/logbook/FilterSheet';
import {LogbookControls} from '../../components/logbook/LogbookControls';
import {MonthHeader} from '../../components/logbook/MonthHeader';
import {OptionSheet} from '../../components/logbook/OptionSheet';
import {PeriodSummaryCard} from '../../components/logbook/PeriodSummaryCard';
import {RoutesFullscreen} from '../../components/logbook/RoutesFullscreen';
import {RoutesOverviewMap} from '../../components/logbook/RoutesOverviewMap';
import {SELECT_BAR_SPACE, SelectBar} from '../../components/logbook/SelectBar';
import {TripRow} from '../../components/logbook/TripRow';
import {TripRowSkeleton} from '../../components/logbook/TripRowSkeleton';
import {StickyHeaderScroll} from '../../components/StickyHeaderScroll';
import {useTabBarInset} from '../../components/tabBarLayout';
import type {TripSummary} from '../../services/tripService';
import {useLogbookStore} from '../../stores/logbookStore';
import {useRecordingStore} from '../../stores/recordingStore';
import {useVehicleStore} from '../../stores/vehicleStore';
import {useAppTheme} from '../../theme/ThemeProvider';
import {groupByMonth, PERIODS, SORTS} from '../../utils/logbook';
import {ActionButton} from '../../components/ActionButton';

type Sheet = 'sort' | 'period' | 'filter' | null;

function EmptyState({text, action, onPress}: {text: string; action?: string; onPress?: () => void}) {
  const theme = useAppTheme();
  return (
    <Card style={{alignItems: 'center', gap: 12, paddingVertical: 28, paddingHorizontal: 20}}>
      <Ionicons name="car-outline" size={30} color={theme.colors.textTertiary} />
      <AppText size={15} weight="bold" tone="secondary" style={{textAlign: 'center'}}>
        {text}
      </AppText>
      {action && onPress ? (
        <ActionButton variant="soft" label={action} onPress={onPress} height={40} size={14} />
      ) : null}
    </Card>
  );
}

/** My Logbook: Rovy's summary, routes map and drive list, with Odo's search, sort and period chips. */
export default function LogbookScreen() {
  const theme = useAppTheme();
  const c = theme.colors;
  const live = useRecordingStore((s) => s.status !== 'ready');
  const bottomInset = useTabBarInset(live);
  const {filters, items, totals, routes, status, error, loadingMore, selecting, selected, deleting} = useLogbookStore();
  const {setFilters, load, loadMore, startSelect, stopSelect, toggle, selectAll, deleteSelected} = useLogbookStore();
  const loadVehicles = useVehicleStore((s) => s.load);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [routesOpen, setRoutesOpen] = useState(false);
  // Remounting the controls clears the search box when filters are cleared from elsewhere.
  const [controlsKey, setControlsKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const narrowed = filters.search.trim() !== '' || filters.vehicleId != null || filters.minScore != null;
  const period = PERIODS.find((p) => p.value === filters.period) ?? PERIODS[1];
  const sort = SORTS.find((s) => s.value === filters.sort) ?? SORTS[0];
  const byDate = filters.sort === 'newest' || filters.sort === 'oldest';
  const openTrip = (id: string) => router.push(`/trip/${id}`);

  const clearFilters = () => {
    setControlsKey((k) => k + 1);
    void setFilters({search: '', vehicleId: null, minScore: null});
  };

  const onDelete = () => {
    const n = selected.length;
    Alert.alert(`Delete ${n} ${n === 1 ? 'drive' : 'drives'}?`, "This can't be undone.", [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const {deleted, failed} = await deleteSelected();
          if (failed > 0) {
            Alert.alert(`${deleted} of ${n} deleted`, 'Try again for the rest.');
          }
        },
      },
    ]);
  };

  const row = (trip: TripSummary) => (
    <TripRow
      key={trip.id}
      trip={trip}
      selecting={selecting}
      selected={selected.includes(trip.id)}
      onPress={() => (selecting ? toggle(trip.id) : openTrip(trip.id))}
    />
  );

  const list = (() => {
    if (status === 'loading' && items.length === 0) {
      return <TripRowSkeleton />;
    }
    if (status === 'error' && items.length === 0) {
      return <EmptyState text={error ?? 'Could not load your drives.'} action="Retry" onPress={() => void load()} />;
    }
    if (status === 'ready' && items.length === 0) {
      if (narrowed) {
        return <EmptyState text="No drives match" action="Clear filters" onPress={clearFilters} />;
      }
      if (filters.period !== 'all') {
        return <EmptyState text={period.empty} action="Show all time" onPress={() => void setFilters({period: 'all'})} />;
      }
      return <EmptyState text="No drives yet. Start one from Drive." />;
    }
    if (!byDate) {
      return <View style={{gap: theme.space.cardGap, marginTop: 10}}>{items.map(row)}</View>;
    }
    return groupByMonth(items).map((group) => (
      <View key={group.key} style={{gap: theme.space.cardGap}}>
        <MonthHeader group={group} />
        {group.items.map(row)}
      </View>
    ));
  })();

  return (
    <View style={{flex: 1}}>
      <StickyHeaderScroll
        kicker="My"
        title="Logbook"
        onNearEnd={() => void loadMore()}
        contentContainerStyle={{paddingBottom: bottomInset + (selecting ? SELECT_BAR_SPACE : 0), gap: theme.space.cardGap}}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} tintColor={c.accent} />}>
        <LogbookControls
          key={controlsKey}
          search={filters.search}
          sortLabel={sort.label}
          periodLabel={period.label}
          filterActive={filters.vehicleId != null || filters.minScore != null}
          selecting={selecting}
          onSearch={(search) => void setFilters({search})}
          onOpenSort={() => setSheet('sort')}
          onOpenPeriod={() => setSheet('period')}
          onOpenFilter={() => {
            void loadVehicles();
            setSheet('filter');
          }}
          onToggleSelect={() => (selecting ? stopSelect() : startSelect())}
        />
        {status === 'error' && items.length > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => void load()} style={{backgroundColor: c.accentTint, borderRadius: 16, padding: 12}}>
            <AppText size={13} weight="bold" tone="accent">
              {error} Tap to retry.
            </AppText>
          </Pressable>
        ) : null}
        {totals && totals.count > 0 ? (
          <View style={{marginTop: 8}}>
            <PeriodSummaryCard totals={totals} />
          </View>
        ) : null}
        {routes.length > 0 ? (
          <>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginHorizontal: 4}}>
              <Ionicons name="map" size={14} color={c.accent} />
              <AppText size={14} weight="bold" tone="secondary" style={{flex: 1}}>
                Your Routes
              </AppText>
              <AppText size={12} weight="semibold" tone="tertiary">
                {routes.length} {routes.length === 1 ? 'drive' : 'drives'}
              </AppText>
            </View>
            <Card style={{height: 220, overflow: 'hidden'}}>
              <RoutesOverviewMap routes={routes} onOpenTrip={openTrip} onExpand={() => setRoutesOpen(true)} />
            </Card>
          </>
        ) : null}
        {list}
        {loadingMore ? <ActivityIndicator color={c.accent} style={{marginVertical: 12}} /> : null}
      </StickyHeaderScroll>

      {selecting ? <SelectBar count={selected.length} onSelectAll={selectAll} onDelete={onDelete} deleting={deleting} /> : null}
      <OptionSheet visible={sheet === 'sort'} title="Sort" options={SORTS} value={filters.sort} onPick={(value) => void setFilters({sort: value})} onClose={() => setSheet(null)} />
      <OptionSheet visible={sheet === 'period'} title="Period" options={PERIODS} value={filters.period} onPick={(value) => void setFilters({period: value})} onClose={() => setSheet(null)} />
      {sheet === 'filter' ? (
        <FilterSheet
          visible
          vehicleId={filters.vehicleId}
          minScore={filters.minScore}
          onApply={(patch) => void setFilters(patch)}
          onClose={() => setSheet(null)}
        />
      ) : null}
      <RoutesFullscreen visible={routesOpen} routes={routes} onClose={() => setRoutesOpen(false)} onOpenTrip={openTrip} />
    </View>
  );
}
