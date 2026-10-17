import {router, useFocusEffect} from 'expo-router';
import {useCallback} from 'react';
import {ScrollView, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AppText} from '../../components/AppText';
import {BentoTile} from '../../components/BentoTile';
import {GlassButton} from '../../components/GlassButton';
import {Avatar} from '../../components/profile/Avatar';
import {SheetHeader} from '../../components/profile/SheetHeader';
import {useUnits} from '../../hooks/useUnits';
import {useHomeStore} from '../../stores/homeStore';
import {useProfileStore} from '../../stores/profileStore';
import {useActiveVehicle} from '../../stores/vehicleStore';
import {useAppTheme} from '../../theme/ThemeProvider';
import {DASH, formatDuration, formatG, formatInt} from '../../utils/format';

/** My Profile (Rovy), without the social parts: photo, @handle, vehicle and all-time stats. */
export default function ProfileScreen() {
  const theme = useAppTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const u = useUnits();
  const profile = useProfileStore((s) => s.profile);
  const loadProfile = useProfileStore((s) => s.load);
  const stats = useHomeStore((s) => s.stats);
  const loadStats = useHomeStore((s) => s.load);
  const vehicle = useActiveVehicle();
  const gap = theme.space.cardGap;

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
      void loadStats();
    }, [loadProfile, loadStats]),
  );

  const headline = [
    {label: 'Drives', value: formatInt(stats?.trip_count)},
    {label: 'Streak', value: formatInt(stats?.streak_days)},
    {label: 'Score', value: formatInt(stats?.score?.current)},
  ];
  const known = (value: string, unit: string) => (value === DASH ? undefined : unit);
  const topSpeed = u.speed(stats?.top_speed_mps);
  const total = u.distance(stats?.total_distance_meters);
  const avgDrive = u.distance(stats?.avg_trip_distance_meters);

  return (
    <View style={{flex: 1, backgroundColor: c.canvas}}>
      <SheetHeader
        title="My Profile"
        left={
          <GlassButton accessibilityLabel="Done" onPress={() => router.back()} style={{height: 44, paddingHorizontal: 18}}>
            <AppText size={17} weight="bold">
              Done
            </AppText>
          </GlassButton>
        }
        right={
          <GlassButton accessibilityLabel="Edit profile" onPress={() => router.push('/settings/edit-profile')} style={{height: 44, paddingHorizontal: 18}}>
            <AppText size={17} weight="extrabold" tone="accent">
              Edit
            </AppText>
          </GlassButton>
        }
      />
      <ScrollView contentContainerStyle={{paddingHorizontal: theme.space.screen, paddingBottom: insets.bottom + 32, alignItems: 'stretch'}}>
        <View style={{alignItems: 'center', marginTop: 12, gap: 6}}>
          <Avatar profile={profile} size={132} />
          <AppText size={30} weight="black" style={{marginTop: 12}} numberOfLines={1} adjustsFontSizeToFit>
            {profile?.handle ?? 'No handle yet'}
          </AppText>
          <AppText size={16} weight="semibold" tone="secondary">
            {vehicle?.display_name ?? 'No vehicle yet'}
          </AppText>
        </View>

        <View style={{flexDirection: 'row', marginTop: 24, marginBottom: 8}}>
          {headline.map((item, i) => (
            <View key={item.label} style={{flex: 1, flexDirection: 'row'}}>
              {i > 0 ? <View style={{width: 1, marginVertical: 6, backgroundColor: c.separator}} /> : null}
              <View style={{flex: 1, alignItems: 'center'}}>
                <AppText size={24} weight="black">
                  {item.value}
                </AppText>
                <AppText size={13} weight="semibold" tone="secondary">
                  {item.label}
                </AppText>
              </View>
            </View>
          ))}
        </View>

        <AppText size={18} weight="black" style={{marginTop: 22, marginBottom: 12}}>
          My Stats
        </AppText>
        <View style={{gap}}>
          <View style={{flexDirection: 'row', gap}}>
            <BentoTile label="Top Speed" value={topSpeed} unit={known(topSpeed, u.speedUnit)} icon="speedometer" iconColor={c.accent} />
            <BentoTile label="Total Distance" value={total} unit={known(total, u.distanceUnit)} icon="map" iconColor={c.cyan} />
          </View>
          <View style={{flexDirection: 'row', gap}}>
            <BentoTile label="Drives" value={formatInt(stats?.trip_count)} icon="car-sport" iconColor={c.blue} />
            <BentoTile label="Drive Time" value={formatDuration(stats?.drive_time_seconds)} icon="time" iconColor={c.teal} />
          </View>
          <View style={{flexDirection: 'row', gap}}>
            <BentoTile label="Avg Drive" value={avgDrive} unit={known(avgDrive, u.distanceUnit)} icon="git-commit" iconColor={c.mint} />
            <BentoTile label="Max G-Force" value={stats?.max_g ? `${stats.max_g.estimated ? '≈' : ''}${formatG(stats.max_g.value)}` : DASH} unit={stats?.max_g ? 'G' : undefined} icon="magnet" iconColor={c.purple} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
