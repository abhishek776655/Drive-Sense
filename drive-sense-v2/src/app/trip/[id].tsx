import {Ionicons} from '@expo/vector-icons';
import {router, useLocalSearchParams} from 'expo-router';
import {useEffect, useMemo, useState} from 'react';
import {BlurView} from 'expo-blur';
import {LinearGradient} from 'expo-linear-gradient';
import {Alert, Animated, InteractionManager, Platform, Share, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AppText} from '../../components/AppText';
import {BentoTile} from '../../components/BentoTile';
import {Card} from '../../components/Card';
import {VehiclePickerSheet} from '../../components/drive/VehiclePickerSheet';
import {ScoreEventsCard} from '../../components/summary/ScoreEventsCard';
import {Split} from '../../components/summary/Split';
import {AltitudeCard, TurnsCard} from '../../components/HomeDetailCards';
import {DistanceByTimeCard} from '../../components/trip/DistanceByTimeCard';
import {ElevationCard} from '../../components/trip/ElevationCard';
import {GForceSummaryCard} from '../../components/trip/GForceSummaryCard';
import {clockTime} from '../../components/trip/timeOfDay';
import {EventsCard} from '../../components/trip/EventsCard';
import {GForceCard} from '../../components/trip/GForceCard';
import {InsightsList} from '../../components/trip/InsightsList';
import {PlaceCard} from '../../components/trip/PlaceCard';
import {RouteFullscreen} from '../../components/trip/RouteFullscreen';
import {MapButton} from '../../components/trip/MapButton';
import {ReplayModal} from '../../components/trip/ReplayModal';
import {TripWeatherCard} from '../../components/trip/TripWeatherCard';
import {GlassButton} from '../../components/GlassButton';
import {SectionTitle} from '../../components/trip/SectionTitle';
import {CarSection} from '../../components/trip/CarSection';
import {RoadSection} from '../../components/trip/RoadSection';
import {useTripSensors} from '../../hooks/useTripSensors';
import {SpeedChart} from '../../components/trip/SpeedChart';
import {StopsCard} from '../../components/trip/StopsCard';
import {TimeAtSpeedCard} from '../../components/trip/TimeAtSpeedCard';
import {TRIP_ACTION_BAR_SPACE, TripActionBar} from '../../components/trip/TripActionBar';
import {TripDetailSkeleton} from '../../components/trip/TripDetailSkeleton';
import {TripRouteMap} from '../../components/trip/TripRouteMap';
import type {LatLng, TripRouteMapProps} from '../../components/trip/TripRouteMap.types';
import type {TripDetail} from '../../services/tripService';
import {useUnits} from '../../hooks/useUnits';
import {useTripDetailStore} from '../../stores/tripDetailStore';
import {useVehicleStore} from '../../stores/vehicleStore';
import type {AppTheme} from '../../theme/theme';
import {withAlpha} from '../../theme/color';
import {softShadow} from '../../theme/shadow';
import {useAppTheme} from '../../theme/ThemeProvider';
import {formatMeters, formatSpan} from '../../utils/format';
import {formatDriveTime} from '../../utils/summaryFormat';
import {analyseTrip, dayPeriod, timeOverLimit, type TripAnalysis} from '../../utils/tripAnalysis';
import {EVENT_LABEL, eventBreakdown, HARD_INTENSITY} from '../../utils/tripEvents';
import {ActionButton} from '../../components/ActionButton';
import {usePreferencesStore} from '../../stores/preferencesStore';
import {kmhInUnits} from '../../utils/units';

type IconName = keyof typeof Ionicons.glyphMap;

/** Header row (44 pt buttons) plus the gap before the first card. */
const HEADER_ROW = 58;
/** Fade below the header so cards blur in gradually. */
const HEADER_FADE = 18;
/** Stacked blur layers: the top is covered by all of them, so blur ramps up towards it. */
const BLUR_STEPS = 5;
type Tile = {label: string; value: string; unit?: string; icon: IconName; color: string};

/** Stat tiles; a tile with nothing to show is left out and the rest reflow. */
const buildTiles = (detail: TripDetail, analysis: TripAnalysis, c: AppTheme['colors'], u: ReturnType<typeof useUnits>, limitKmh: number): Tile[] => {
  const over = timeOverLimit(analysis.segments, limitKmh);
  const gps = analysis.gps;
  const gpsColor = gps ? {good: c.green, fair: c.amber, poor: c.red}[gps.grade] : c.textSecondary;
  const {movingS, idleS} = analysis.times;
  const tiles: (Tile | null)[] = [
    {label: 'Distance', value: u.distance(detail.distance_meters), unit: u.distanceUnit, icon: 'map', color: c.blue},
    {
      label: 'Avg speed',
      // Moving time only, as on Drive and Home: waiting at lights does not drag it down.
      value: u.speed(movingS > 0 ? detail.distance_meters / movingS : detail.avg_speed_mps),
      unit: u.speedUnit,
      icon: 'speedometer',
      color: c.cyan,
    },
    {label: 'Stops', value: String(analysis.stops.length), icon: 'stop-circle', color: c.red},
    {label: 'Idle time', value: formatSpan(idleS || detail.idle_time_seconds), icon: 'pause-circle', color: c.textSecondary},
    analysis.smoothness != null ? {label: 'Smoothness', value: String(analysis.smoothness), unit: '/ 100', icon: 'leaf', color: c.mint} : null,
    // Moving time above the Settings speed-alert limit, and its share of the drive.
    {
      label: `Over ${kmhInUnits(limitKmh, u.units)} ${u.speedUnit}`,
      value: formatSpan(over.seconds),
      unit: over.share != null && over.seconds > 0 ? `${Math.max(1, Math.round(over.share * 100))}%` : undefined,
      icon: 'warning',
      color: over.seconds > 0 ? c.red : c.green,
    },
    analysis.elevation ? {label: 'Climb', value: formatMeters(analysis.elevation.gainM), unit: 'm', icon: 'trending-up', color: c.teal} : null,
    gps ? {label: `GPS · ${gps.grade === 'good' ? 'Good' : gps.grade === 'fair' ? 'Fair' : 'Weak'}`, value: `±${Math.round(gps.medianM)}`, unit: 'm', icon: 'locate', color: gpsColor} : null,
  ];
  return tiles.filter((t): t is Tile => t !== null);
};

function Message({text, action, onPress}: {text: string; action: string; onPress: () => void}) {
  return (
    <Card style={{padding: 20, gap: 14, alignItems: 'center'}}>
      <AppText size={15} weight="bold" tone="secondary" style={{textAlign: 'center'}}>
        {text}
      </AppText>
      <ActionButton label={action} onPress={onPress} height={42} size={15} />
    </Card>
  );
}

/** A past drive from Logbook: route by speed, numbers, score, and the speed / elevation / stops story. */
export default function TripDetailScreen() {
  const theme = useAppTheme();
  const c = theme.colors;
  const u = useUnits();
  const insets = useSafeAreaInsets();
  // iOS shows this as a sheet when opened over another screen, starting below the status bar.
  // Full screen (Android, or opened from a link with nothing beneath) it clears the status bar.
  const [asSheet] = useState(() => Platform.OS === 'ios' && router.canGoBack());
  const sheetTop = asSheet ? 18 : insets.top + 8;
  const headerHeight = sheetTop + HEADER_ROW;
  const [scrollY] = useState(() => new Animated.Value(0));
  const blurOpacity = scrollY.interpolate({inputRange: [0, 24], outputRange: [0, 1], extrapolate: 'clamp'});
  const {id} = useLocalSearchParams<{id: string}>();
  const limitKmh = usePreferencesStore((s) => s.speedAlertKmh);
  const entry = useTripDetailStore((s) => s.trips[id]);
  const load = useTripDetailStore((s) => s.load);
  const remove = useTripDetailStore((s) => s.remove);
  const changeVehicle = useTripDetailStore((s) => s.changeVehicle);
  const actionError = useTripDetailStore((s) => s.actionError);
  const clearActionError = useTripDetailStore((s) => s.clearActionError);
  const busy = useTripDetailStore((s) => s.busy);
  const loadVehicles = useVehicleStore((s) => s.load);
  const [fullscreen, setFullscreen] = useState<{open: boolean; focus: LatLng | null}>({open: false, focus: null});
  const [picking, setPicking] = useState(false);
  const [replaying, setReplaying] = useState(false);

  // The page opens at once on its skeleton; the drive is read and its (heavy) cards built only after
  // the open transition, so tapping a drive never freezes on the list.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    clearActionError();
    const task = InteractionManager.runAfterInteractions(() => {
      setSettled(true);
      void load(id);
    });
    return () => task.cancel();
  }, [id, load, clearActionError]);

  const detail = settled ? (entry?.detail ?? null) : null;
  const analysis = useMemo(() => (detail ? analyseTrip(detail.location_points) : null), [detail]);
  const breakdown = useMemo(() => (detail ? eventBreakdown(detail.events) : null), [detail]);
  // This phone's own sensor summary of the drive (corners, road, phone use), when it recorded one.
  const sensors = useTripSensors(detail?.start_time ?? null);
  const roughSpots = useMemo(
    () => (sensors?.road.segments ?? []).flatMap((s) => (s.level === 'smooth' ? [] : [{latitude: s.latitude, longitude: s.longitude, level: s.level}])),
    [sensors],
  );
  // Located events for the map; the title and description show when a marker is tapped.
  const events: TripRouteMapProps['events'] = useMemo(() => {
    const list: TripRouteMapProps['events'] = (breakdown?.list ?? []).flatMap((e) => {
      if (e.latitude == null || e.longitude == null) {
        return [];
      }
      let lat = e.latitude;
      let lon = e.longitude;
      if (analysis && analysis.points.length > 0) {
        let best = 0;
        let bestDiff = Infinity;
        for (let i = 0; i < analysis.points.length; i++) {
          const pt = analysis.points[i];
          const diff = Math.abs(pt.t - e.at);
          if (diff < bestDiff) {
            best = i;
            bestDiff = diff;
          }
        }
        lat = analysis.points[best].latitude;
        lon = analysis.points[best].longitude;
      }
      return [
        {
          id: e.id,
          kind: e.kind,
          latitude: lat,
          longitude: lon,
          title: `${EVENT_LABEL[e.kind]}${(e.intensity ?? 0) >= HARD_INTENSITY ? ' · hard' : ''}`,
          description: `${clockTime(e.at)}${e.intensity != null ? ` · ${e.intensity.toFixed(1)}× the limit` : ''}`,
          // The replay's event card reads the moment and the measure.
          at: e.at,
          intensity: e.intensity ?? null,
        },
      ];
    });

    if (analysis && analysis.points.length > 0) {
      const top = analysis.points.reduce<(typeof analysis.points)[number] | null>(
        (best, p) => (best == null || p.mps > best.mps ? p : best),
        null,
      );
      if (top && top.mps > 0) {
        list.push({
          id: 'top-speed',
          kind: 'top_speed',
          latitude: top.latitude,
          longitude: top.longitude,
          title: 'Top speed',
          description: `${u.speed(top.mps)} ${u.speedUnit}`,
          at: top.t,
          intensity: null,
          kmh: top.mps * 3.6,
        });
      }
    }
    return list;
  }, [breakdown, analysis, u]);
  const [showEvents, setShowEvents] = useState(true);
  const toggleEvents = () => setShowEvents((v) => !v);
  const showOnMap = (focus: LatLng) => setFullscreen({open: true, focus});
  const back = () => (router.canGoBack() ? router.back() : router.replace('/logbook'));

  const onDelete = () =>
    Alert.alert('Delete this drive?', "This can't be undone.", [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (await remove(id)) {
            back();
          }
        },
      },
    ]);
  const onShare = () => {
    if (!detail) {
      return;
    }
    const score = detail.driving_score != null ? `, score ${Math.round(detail.driving_score)}` : '';
    void Share.share({
      message: `Drove ${u.distance(detail.distance_meters)} ${u.distanceUnit} in ${formatDriveTime(detail.duration_seconds)}, top speed ${u.speed(detail.max_speed_mps)} ${u.speedUnit}${score}. Recorded with DriveSense.`,
    });
  };
  const onChangeVehicle = () => {
    void loadVehicles();
    setPicking(true);
  };
  const start = detail ? new Date(detail.start_time) : null;
  const title = detail?.start_address?.split(',')[0] ?? 'Drive';
  const subtitle = start
    ? `${start.toLocaleDateString('en-IN', {weekday: 'short', day: 'numeric', month: 'short'})} · ${detail?.vehicle_name ?? ''}`
    : '';

  const body = (() => {
    if (!settled || !entry || entry.status === 'loading') {
      return <TripDetailSkeleton />;
    }
    if (entry.status === 'missing') {
      return <Message text="This drive no longer exists." action="Back" onPress={back} />;
    }
    if (entry.status === 'error' || !detail || !analysis) {
      return <Message text={entry.error ?? 'Could not load this drive.'} action="Retry" onPress={() => void load(id, {force: true})} />;
    }
    const hasAnalysis = analysis.points.length > 1;
    const peakAccel = analysis.gforce.peakAccel?.g ?? null;
    const peakBrake = analysis.gforce.peakBrake ? -analysis.gforce.peakBrake.g : null;
    const gpsMaxG = Math.max(peakAccel ?? 0, peakBrake ?? 0) || null;
    // A phone-sensor reading is the real peak; otherwise use the same GPS figures as the chart below.
    const sensorG = detail.max_g_source === 'sensor' ? detail.max_g_force : null;
    const maxG = sensorG ?? gpsMaxG;
    const topSpeedMps = detail.max_speed_mps ?? (analysis.speed.peak ? analysis.speed.peak.kmh / 3.6 : null);
    return (
      <View style={{gap: theme.space.cardGap}}>
        <Card style={{overflow: 'hidden'}}>
          <View style={{height: 260}}>
            <TripRouteMap points={analysis.points} events={events} roughSpots={roughSpots} onExpand={() => setFullscreen({open: true, focus: null})} />
          </View>
        </Card>
        {analysis.points.length > 1 ? (
          <GlassButton accessibilityLabel="Replay drive" onPress={() => setReplaying(true)} radius={26} style={{height: 52, flexDirection: 'row', gap: 8}}>
            <Ionicons name="play" size={18} color={c.textPrimary} />
            <AppText size={17} weight="extrabold">
              Replay Drive
            </AppText>
          </GlassButton>
        ) : null}
        <View style={{backgroundColor: c.accentTint, borderRadius: theme.radius.hero, paddingVertical: 22, ...softShadow(c)}}>
          <Split dividerColor={withAlpha(c.accent, 0.22)}>
            <>
              <AppText size={46} weight="black" style={{lineHeight: 52}}>
                {u.speed(topSpeedMps)}
              </AppText>
              <AppText size={13} weight="extrabold" tone="accent">
                {u.speedUnit} Top Speed
              </AppText>
            </>
            <>
              <AppText size={46} weight="black" style={{lineHeight: 52}}>
                {formatDriveTime(detail.duration_seconds)}
              </AppText>
              <AppText size={13} weight="extrabold" tone="accent">
                Drive Time
              </AppText>
            </>
          </Split>
        </View>
        {/* The weather when the drive started, then where it went. */}
        {analysis.points.length > 0 ? (
          <TripWeatherCard tripId={detail.id} latitude={analysis.points[0].latitude} longitude={analysis.points[0].longitude} startTime={detail.start_time} />
        ) : null}
        <PlaceCard startAddress={detail.start_address} endAddress={detail.end_address} startTime={detail.start_time} endTime={detail.end_time} period={dayPeriod(detail.start_time)} />
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.cardGap}}>
          {buildTiles(detail, analysis, c, u, limitKmh).map((t) => (
            <BentoTile key={t.label} label={t.label} value={t.value} unit={t.unit} icon={t.icon} iconColor={t.color} style={{flexBasis: '45%', flexGrow: 1}} />
          ))}
        </View>
        <View style={{flexDirection: 'row', gap: theme.space.cardGap}}>
          <View style={{flex: 1}}>
            <BentoTile
              label="Moving time"
              value={analysis.times.movingS > 0 ? formatSpan(analysis.times.movingS) : formatSpan(detail.duration_seconds - detail.idle_time_seconds)}
              icon="play-circle"
              iconColor={c.green}
            />
          </View>
          <View style={{flex: 1}}>
            <AltitudeCard highest={analysis.elevation?.maxM ?? null} lowest={analysis.elevation?.minM ?? null} />
          </View>
        </View>
        <TurnsCard left={detail.left_turns} right={detail.right_turns} />
        <GForceSummaryCard maxG={maxG} approximate={sensorG == null && maxG != null} accelG={peakAccel} brakeG={peakBrake} corner={sensors?.corners.hardest?.peakG ?? null} />

        <SectionTitle icon="ribbon" color={c.green} title="Score" />
        <ScoreEventsCard detail={detail} pending={false} phoneEventCount={detail.events.length} showEvents={false} />
        <InsightsList insights={detail.insights} />

        <SectionTitle icon="speedometer" color={c.amber} title="Acceleration & braking" />
        <EventsCard breakdown={breakdown ?? eventBreakdown([])} onSelect={(event) => event.latitude != null && event.longitude != null && showOnMap({latitude: event.latitude, longitude: event.longitude})} />

        {hasAnalysis ? (
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24}}>
            <View style={{width: 32, height: 32, borderRadius: 10, backgroundColor: c.accentTint, alignItems: 'center', justifyContent: 'center'}}>
              <Ionicons name="analytics" size={18} color={c.accent} />
            </View>
            <AppText size={20} weight="black">
              Drive Analysis
            </AppText>
          </View>
        ) : null}

        {analysis.speed.samples.length > 1 ? (
          <>
            <SectionTitle icon="pulse" color={c.accent} title="Speed" />
            <SpeedChart samples={analysis.speed.samples} peak={analysis.speed.peak} />
            <TimeAtSpeedCard bands={analysis.bands} />
          </>
        ) : null}

        <RoadSection sensors={sensors} />

        <CarSection startTime={detail.start_time} />

        {analysis.gforce.samples.length > 1 ? (
          <>
            <SectionTitle icon="swap-vertical" color={c.purple} title="G-Force" />
            <GForceCard {...analysis.gforce} sensor={analysis.sensorG} sensorMaxG={detail.max_g_source === 'sensor' ? detail.max_g_force : null} />
          </>
        ) : null}

        {hasAnalysis ? (
          <>
            <SectionTitle icon="triangle" color={c.cyan} title="Climb & descent" />
            {analysis.elevation ? (
              <ElevationCard profile={analysis.elevation} />
            ) : (
              <Card style={{padding: 18}}>
                <AppText size={13} weight="semibold" tone="secondary" style={{textAlign: 'center'}}>
                  No altitude was recorded on this drive, so there is no climb or descent to show.
                </AppText>
              </Card>
            )}
          </>
        ) : null}

        {analysis.distance.buckets.length > 0 ? (
          <>
            <SectionTitle icon="bar-chart" color={c.cyan} title={analysis.distance.bucketMinutes === 60 ? 'Distance by hour' : 'Distance over time'} />
            <DistanceByTimeCard buckets={analysis.distance.buckets} bucketMinutes={analysis.distance.bucketMinutes} />
          </>
        ) : null}

        {analysis.stops.length > 0 ? (
          <>
            <SectionTitle icon="pause-circle" color={c.textSecondary} title="Stops" />
            <StopsCard stops={analysis.stops} onSelect={(stop) => showOnMap({latitude: stop.latitude, longitude: stop.longitude})} />
          </>
        ) : null}
      </View>
    );
  })();

  return (
    <View style={{flex: 1, backgroundColor: c.canvas}}>
      <Animated.ScrollView
        scrollEventThrottle={16}
        onScroll={Animated.event([{nativeEvent: {contentOffset: {y: scrollY}}}], {useNativeDriver: true})}
        scrollIndicatorInsets={{top: headerHeight}}
        contentContainerStyle={{paddingTop: headerHeight, paddingHorizontal: theme.space.screen, paddingBottom: insets.bottom + 24 + TRIP_ACTION_BAR_SPACE}}>
        {actionError ? (
          <View style={{backgroundColor: c.accentTint, borderRadius: 16, padding: 12, marginBottom: 10}}>
            <AppText size={13} weight="bold" tone="accent">
              {actionError}
            </AppText>
          </View>
        ) : null}
        {body}
      </Animated.ScrollView>
      {/* Pinned header: close, title, share. Content scrolls under it through a blur that fades in. */}
      <View pointerEvents="box-none" style={{position: 'absolute', top: 0, left: 0, right: 0, height: headerHeight + HEADER_FADE}}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {opacity: blurOpacity}]}>
          {Array.from({length: BLUR_STEPS}, (_, i) => (
            <BlurView
              key={i}
              intensity={8}
              tint={c.glassBlurTint}
              blurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
              style={{position: 'absolute', left: 0, right: 0, top: 0, height: (headerHeight + HEADER_FADE) * ((BLUR_STEPS - i) / BLUR_STEPS)}}
            />
          ))}
          <LinearGradient
            colors={[withAlpha(c.canvas, 0.92), withAlpha(c.canvas, 0.65), withAlpha(c.canvas, 0)]}
            locations={[0, 0.6, 1]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: sheetTop, paddingHorizontal: theme.space.screen}}>
          <MapButton icon="close" label="Close" onPress={back} size={44} color={c.accent} />
          <View style={{flex: 1, alignItems: 'center'}}>
            <AppText size={18} weight="black" numberOfLines={1}>
              {title}
            </AppText>
            <AppText size={12} weight="semibold" tone="secondary" numberOfLines={1}>
              {subtitle}
            </AppText>
          </View>
          <MapButton icon="share-outline" label="Share drive" onPress={onShare} size={44} color={c.accent} disabled={!detail} />
        </View>
      </View>
      {analysis ? (
        <RouteFullscreen
          visible={fullscreen.open}
          onClose={() => setFullscreen({open: false, focus: null})}
          points={analysis.points}
          events={events}
          roughSpots={roughSpots}
          focus={fullscreen.focus}
          showEvents={showEvents}
          onToggleEvents={toggleEvents}
        />
      ) : null}
      {analysis ? <ReplayModal visible={replaying} onClose={() => setReplaying(false)} points={analysis.points} events={events} /> : null}
      {detail ? <TripActionBar onChangeVehicle={onChangeVehicle} onDelete={onDelete} busy={busy} disabled={!detail} /> : null}
      <VehiclePickerSheet visible={picking} onClose={() => setPicking(false)} selectedId={detail?.vehicle_id ?? null} onPick={(vehicleId) => void changeVehicle(id, vehicleId)} />
    </View>
  );
}
