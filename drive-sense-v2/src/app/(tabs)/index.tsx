import {Ionicons} from '@expo/vector-icons';
import {router, useFocusEffect} from 'expo-router';
import {useCallback} from 'react';
import {Pressable, RefreshControl, View} from 'react-native';
import {AppText} from '../../components/AppText';
import {BentoTile} from '../../components/BentoTile';
import {WeekGoalTile} from '../../components/WeekGoalTile';
import {LevelTile} from '../../components/LevelTile';
import {HeroTile} from '../../components/HeroTile';
import {LastTripCard} from '../../components/LastTripCard';
import {StickyHeaderScroll} from '../../components/StickyHeaderScroll';
import {AltitudeCard, EventsCard, SectionLabel, TurnsCard} from '../../components/HomeDetailCards';
import {Card} from '../../components/Card';
import {useTabBarInset} from '../../components/tabBarLayout';
import {TrendChart} from '../../components/TrendChart';
import {WeatherCard} from '../../components/WeatherCard';
import {WeatherSkeleton} from '../../components/WeatherSkeleton';
import {useUnits} from '../../hooks/useUnits';
import {useHomeStore} from '../../stores/homeStore';
import {useRecordingStore} from '../../stores/recordingStore';
import {useWeatherStore} from '../../stores/weatherStore';
import {useAchievementsStore} from '../../stores/achievementsStore';
import {useProfileStore} from '../../stores/profileStore';
import {useAppTheme} from '../../theme/ThemeProvider';
import {DASH, formatDuration, formatInt} from '../../utils/format';

/** Each right-hand tile beside the hero; the hero spans two of them plus the gap. */
const HERO_TILE_HEIGHT = 76;

export default function HomeScreen() {
  const theme = useAppTheme();
  const c = theme.colors;
  const u = useUnits();
  const live = useRecordingStore((s) => s.status !== 'ready');
  const bottomInset = useTabBarInset(live);
  const {stats, lastTrip, trend, loading, error, load} = useHomeStore();
  const weather = useWeatherStore((s) => s.weather);
  const weatherStatus = useWeatherStore((s) => s.status);
  const loadWeather = useWeatherStore((s) => s.load);
  const achievements = useAchievementsStore((s) => s.data);
  const loadAchievements = useAchievementsStore((s) => s.load);
  const loadProfile = useProfileStore((s) => s.load);

  useFocusEffect(
    useCallback(() => {
      void load();
      void loadWeather();
      void loadAchievements();
      // The weekly goal and streak unit come from the profile.
      void loadProfile();
    }, [load, loadWeather, loadAchievements, loadProfile]),
  );

  const gap = theme.space.cardGap;
  const score = stats?.score;
  const delta = score?.delta;
  const maxG = stats?.max_g;

  return (
    <StickyHeaderScroll
      kicker="My"
      title="Stats"
      contentContainerStyle={{paddingBottom: bottomInset}}
      refreshControl={
        <RefreshControl
          refreshing={loading && stats != null}
          onRefresh={() => {
            void load();
            void loadWeather(true);
          }}
          tintColor={c.accent}
        />
      }>

      {weather ? (
        <View style={{marginBottom: 26}}>
          <WeatherCard weather={weather} />
        </View>
      ) : weatherStatus === 'loading' || weatherStatus === 'idle' ? (
        <View style={{marginBottom: 26}}>
          <WeatherSkeleton />
        </View>
      ) : weatherStatus === 'error' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Weather unavailable. Retry"
          onPress={() => void loadWeather(true)}
          style={{flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderRadius: 20, padding: 16, marginBottom: 26}}>
          <Ionicons name="cloud-offline" size={22} color={c.textSecondary} />
          <View style={{flex: 1}}>
            <AppText size={15} weight="extrabold">
              Weather unavailable
            </AppText>
            <AppText size={12} weight="semibold" tone="secondary">
              No location or no connection right now.
            </AppText>
          </View>
          <AppText size={14} weight="black" tone="accent">
            Retry
          </AppText>
        </Pressable>
      ) : null}

      {error ? (
        <Pressable accessibilityRole="button" onPress={load} style={{backgroundColor: c.accentTint, borderRadius: 16, padding: 12, marginBottom: gap}}>
          <AppText size={13} weight="bold" tone="accent">
            {error} Tap to retry.
          </AppText>
        </Pressable>
      ) : null}

      {/* Equal flex-basis columns so the hero lines up with the tile column below it. */}
      <View style={{flexDirection: 'row', gap, height: 2 * HERO_TILE_HEIGHT + gap}}>
        <View style={{flexGrow: 1, flexBasis: 0, minWidth: 0}}>
          <HeroTile label="Top speed" value={u.speed(stats?.top_speed_mps)} unit={u.speedUnit} />
        </View>
        <View style={{flexGrow: 1, flexBasis: 0, minWidth: 0, gap}}>
          <BentoTile label={`Total ${u.distanceUnit}`} value={u.distance(stats?.total_distance_meters)} icon="map" iconColor={c.cyan} />
          <BentoTile
            label="Streak"
            value={formatInt(stats?.streak_days)}
            unit={stats?.streak_days != null ? (stats.streak_unit === 'weeks' ? 'weeks' : 'days') : undefined}
            icon="flame"
            iconColor={c.red}
          />
        </View>
      </View>

      <View style={{flexDirection: 'row', gap, marginTop: gap}}>
        <BentoTile label="Avg Speed" value={u.speed(stats?.avg_speed_mps)} unit={u.speedUnit} icon="speedometer" iconColor={c.accent} />
        <BentoTile
          label="Driving Score"
          value={formatInt(score?.current)}
          icon="ribbon"
          iconColor={c.green}
          accessory={
            delta != null && delta !== 0 ? (
              <AppText size={12} weight="extrabold" color={delta > 0 ? c.green : c.red}>
                {delta > 0 ? '▲' : '▼'} {Math.abs(Math.round(delta))}
              </AppText>
            ) : null
          }
        />
      </View>

      {/* This week's goal beside the level, each half a row (either may be missing). */}
      {stats || achievements ? (
        <View style={{flexDirection: 'row', gap, marginTop: gap}}>
          {/* Equal columns, the same split as the tiles above. */}
          {stats ? (
            <View style={{flex: 1, flexBasis: 0}}>
              <WeekGoalTile target={stats.week_goal?.target ?? null} done={stats.week_goal?.done ?? 0} />
            </View>
          ) : null}
          {achievements ? (
            <View style={{flex: 1, flexBasis: 0}}>
              <LevelTile data={achievements} onPress={() => router.push('/settings/achievements')} />
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={{flexDirection: 'row', gap, marginTop: gap}}>
        <BentoTile label="Trips" value={formatInt(stats?.trip_count)} icon="car-sport" iconColor={c.blue} />
        <BentoTile label="Drive Time" value={formatDuration(stats?.drive_time_seconds)} icon="time" iconColor={c.teal} />
      </View>
      <View style={{flexDirection: 'row', gap, marginTop: gap}}>
        <BentoTile
          label="Max G-Force"
          value={maxG ? `${maxG.estimated ? '≈' : ''}${maxG.value.toFixed(2)}` : DASH}
          unit="G"
          icon="magnet"
          iconColor={c.purple}
        />
        <BentoTile label="Avg Trip" value={u.distance(stats?.avg_trip_distance_meters)} unit={u.distanceUnit} icon="git-commit" iconColor={c.mint} />
      </View>

      <View style={{flexDirection: 'row', gap, marginTop: gap}}>
        <TurnsCard left={stats?.turns?.left ?? null} right={stats?.turns?.right ?? null} />
        <EventsCard accel={stats?.events?.accel ?? null} brake={stats?.events?.brake ?? null} />
      </View>
      <View style={{marginTop: gap}}>
        <AltitudeCard highest={stats?.altitude?.highest_m ?? null} lowest={stats?.altitude?.lowest_m ?? null} />
      </View>

      {trend.length > 0 ? (
        <>
          <SectionLabel>DISTANCE TREND</SectionLabel>
          <TrendChart days={trend} title={`Last ${trend.length} days`} />
        </>
      ) : null}
      {lastTrip ? (
        <>
          <SectionLabel>LAST TRIP</SectionLabel>
          <LastTripCard trip={lastTrip} />
        </>
      ) : null}

      <Pressable accessibilityRole="button" accessibilityLabel="All stats" onPress={() => router.push('/all-stats')} style={{marginTop: 16}}>
        {({pressed}) => (
          <Card style={{minHeight: 56, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, opacity: pressed ? 0.7 : 1}}>
            <AppText size={15} weight="extrabold" tone="accent">
              All stats
            </AppText>
            <Ionicons name="arrow-forward" size={16} color={c.accent} />
          </Card>
        )}
      </Pressable>
    </StickyHeaderScroll>
  );
}
