import {useFocusEffect} from 'expo-router';
import {useCallback, useState} from 'react';
import {ActionSheetIOS, Alert, Platform, Pressable, RefreshControl, View} from 'react-native';
import {AppText} from '../../components/AppText';
import {DashedOutline} from '../../components/garage/DashedOutline';
import {GarageStatTile} from '../../components/garage/GarageStatTile';
import {TopSpeedCard} from '../../components/garage/TopSpeedCard';
import {VehicleHeroCard} from '../../components/garage/VehicleHeroCard';
import {VehicleIcon} from '../../components/garage/VehicleIcon';
import {VehicleSheet} from '../../components/garage/VehicleSheet';
import {VehicleStrip} from '../../components/garage/VehicleStrip';
import {StickyHeaderScroll} from '../../components/StickyHeaderScroll';
import {useTabBarInset} from '../../components/tabBarLayout';
import {useUnits} from '../../hooks/useUnits';
import {useRecordingStore} from '../../stores/recordingStore';
import {useActiveVehicle, useVehicleStore} from '../../stores/vehicleStore';
import {withAlpha} from '../../theme/color';
import {useAppTheme} from '../../theme/ThemeProvider';
import {formatDuration, formatInt} from '../../utils/format';
import {pickVehiclePhoto, type PhotoSource} from '../../utils/vehiclePhoto';
import {ActionButton} from '../../components/ActionButton';

type Sheet = 'add' | 'edit' | null;

/** My Garage (Rovy): vehicle strip, the active vehicle's card, its top speed and all-time stats. */
export default function GarageScreen() {
  const theme = useAppTheme();
  const c = theme.colors;
  const u = useUnits();
  const gap = theme.space.cardGap;
  const live = useRecordingStore((s) => s.status !== 'ready');
  const bottomInset = useTabBarInset(live);
  const {vehicles, activeVehicleId, loading, error, stats, load, setActive, loadStats, create, update, remove, setPhoto} = useVehicleStore();
  const vehicle = useActiveVehicle();
  const vehicleStats = vehicle ? stats[vehicle.id] : undefined;
  const [sheet, setSheet] = useState<Sheet>(null);
  const [uploading, setUploading] = useState(false);

  const savePhoto = async (vehicleId: string, source: PhotoSource | 'remove') => {
    try {
      const data = source === 'remove' ? null : await pickVehiclePhoto(source);
      if (source !== 'remove' && data == null) {
        return; // cancelled
      }
      setUploading(true);
      await setPhoto(vehicleId, data);
    } catch (e) {
      Alert.alert('Photo', e instanceof Error ? e.message : 'Could not save the photo.');
    } finally {
      setUploading(false);
    }
  };

  const onPhoto = (vehicleId: string, hasPhoto: boolean) => {
    const sources: {label: string; value: PhotoSource | 'remove'}[] = [
      {label: 'Take Photo', value: 'camera'},
      {label: 'Choose from Library', value: 'library'},
      ...(hasPhoto ? [{label: 'Remove Photo', value: 'remove' as const}] : []),
    ];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {options: [...sources.map((s) => s.label), 'Cancel'], cancelButtonIndex: sources.length, destructiveButtonIndex: hasPhoto ? 2 : undefined, tintColor: c.accent},
        (index) => {
          if (index < sources.length) {
            void savePhoto(vehicleId, sources[index].value);
          }
        },
      );
    } else {
      Alert.alert('Vehicle photo', undefined, [
        ...sources.map((s) => ({text: s.label, style: s.value === 'remove' ? ('destructive' as const) : undefined, onPress: () => void savePhoto(vehicleId, s.value)})),
        {text: 'Cancel', style: 'cancel' as const},
      ]);
    }
  };

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  // Stats follow the active vehicle; refetched on every focus so a finished drive shows up.
  useFocusEffect(
    useCallback(() => {
      if (activeVehicleId) {
        void loadStats(activeVehicleId);
      }
    }, [activeVehicleId, loadStats]),
  );

  return (
    <View style={{flex: 1}}>
      <StickyHeaderScroll
        kicker="My"
        title="Garage"
        contentContainerStyle={{paddingBottom: bottomInset + 12, gap}}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} tintColor={c.accent} />}>
        {error && vehicles.length === 0 ? (
          <Pressable accessibilityRole="button" onPress={() => void load()} style={{backgroundColor: c.accentTint, borderRadius: 16, padding: 12}}>
            <AppText size={13} weight="bold" tone="accent">
              {error} Tap to retry.
            </AppText>
          </Pressable>
        ) : null}

        {vehicles.length > 0 ? <VehicleStrip vehicles={vehicles} activeId={activeVehicleId} onPick={(id) => void setActive(id)} onAdd={() => setSheet('add')} /> : null}

        {vehicle ? (
          <>
            <View style={{marginTop: 14, marginBottom: 14}}>
              <VehicleHeroCard vehicle={vehicle} uploading={uploading} onPhoto={() => onPhoto(vehicle.id, vehicle.photo_url != null)} />
            </View>
            <TopSpeedCard topSpeedMps={vehicleStats?.top_speed_mps} />
            <View style={{flexDirection: 'row', gap}}>
              <GarageStatTile value={formatInt(vehicleStats?.trip_count)} label="Drives" icon="car-sport" />
              <GarageStatTile value={u.speed(vehicleStats?.avg_speed_mps)} label={`Ø ${u.speedUnit}`} icon="speedometer" />
            </View>
            <View style={{flexDirection: 'row', gap}}>
              <GarageStatTile value={u.distance(vehicleStats?.total_distance_meters)} label={u.distanceUnit} icon="map" />
              <GarageStatTile value={formatDuration(vehicleStats?.drive_time_seconds)} label="Time" icon="hourglass" />
              <GarageStatTile value={formatInt(vehicleStats?.streak_days)} label="Streak" icon="flash" />
            </View>
            <ActionButton label="Edit" icon="brush" accessibilityLabel={`Edit ${vehicle.display_name}`} onPress={() => setSheet('edit')} style={{marginTop: 14}} />
          </>
        ) : !loading && !error ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Add your first vehicle" onPress={() => setSheet('add')}>
            {({pressed}) => (
              <View style={{borderRadius: 32, alignItems: 'center', paddingVertical: 40, gap: 14, opacity: pressed ? 0.7 : 1}}>
                <DashedOutline radius={32} color={withAlpha(c.textTertiary, 0.45)} />
                <View style={{width: 96, height: 96, borderRadius: 48, backgroundColor: c.accentTint, alignItems: 'center', justifyContent: 'center'}}>
                  <VehicleIcon type="car" size={50} color={c.accent} />
                </View>
                <AppText size={18} weight="black">
                  Add your first vehicle
                </AppText>
                <AppText size={14} weight="semibold" tone="secondary">
                  Drives are logged against it.
                </AppText>
              </View>
            )}
          </Pressable>
        ) : null}
      </StickyHeaderScroll>

      {sheet === 'add' ? (
        <VehicleSheet
          onSave={async (input) => {
            await create(input);
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'edit' && vehicle ? (
        <VehicleSheet
          vehicle={vehicle}
          onSave={async (input) => {
            await update(vehicle.id, input);
          }}
          onDelete={() => remove(vehicle.id)}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </View>
  );
}
