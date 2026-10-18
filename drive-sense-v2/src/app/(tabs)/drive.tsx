import {Ionicons} from '@expo/vector-icons';
import {useFocusEffect} from 'expo-router';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {Animated, Linking, Pressable, StyleSheet, useWindowDimensions, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Svg, {Defs, RadialGradient, Rect, Stop} from 'react-native-svg';
import {AppText} from '../../components/AppText';
import {CustomizeSheet} from '../../components/drive/CustomizeSheet';
import {DriveMap} from '../../components/drive/DriveMap';
import {DriveTopBar} from '../../components/drive/DriveTopBar';
import {EventToast} from '../../components/drive/EventToast';
import {GaugePanel} from '../../components/drive/GaugePanel';
import {MapCompass} from '../../components/drive/MapCompass';
import {CoordinatesChip} from '../../components/drive/CoordinatesChip';
import {MapSheet} from '../../components/drive/MapSheet';
import {SpeedAlertBanner} from '../../components/drive/SpeedAlertBanner';
import {VehiclePickerSheet} from '../../components/drive/VehiclePickerSheet';
import {TAB_BAR_GAP, TAB_BAR_HEIGHT, tabBarBottom} from '../../components/tabBarLayout';
import {useDriveSettingsStore} from '../../stores/driveSettingsStore';
import {elapsedSeconds, useRecordingStore} from '../../stores/recordingStore';
import {useActiveVehicle, useVehicleStore} from '../../stores/vehicleStore';
import {useNow} from '../../hooks/useNow';
import {useUnits} from '../../hooks/useUnits';
import {useAppTheme} from '../../theme/ThemeProvider';
import {resolveScaleKmh} from '../../utils/gaugeMath';
import {mpsToKmh} from '../../utils/format';
import {statDisplay} from '../../utils/liveStats';

const SHEET_INSET = 12;

export default function DriveScreen() {
  const theme = useAppTheme();
  const u = useUnits();
  const insets = useSafeAreaInsets();
  const {width: windowWidth} = useWindowDimensions();
  const recording = useRecordingStore();
  const settings = useDriveSettingsStore();
  const vehicle = useActiveVehicle();
  const loadVehicles = useVehicleStore((s) => s.load);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [vehiclesOpen, setVehiclesOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void loadVehicles();
    }, [loadVehicles]),
  );

  const live = recording.status !== 'ready';
  const now = useNow(1000, live);
  const elapsed = elapsedSeconds(recording, now);
  // The dial scale is picked in km/h, then speed and scale convert by the same factor so the needle sits where it did.
  const scaleKmh = resolveScaleKmh(settings.scale, mpsToKmh(recording.stats.topSpeedMps));
  const speed = u.speedValue(recording.stats.speedMps) ?? 0;
  const scale = u.speedValue(scaleKmh / 3.6) ?? scaleKmh;
  const stats = useMemo(
    () => settings.stats.map((id) => statDisplay(id, recording.stats, elapsed, u.units)),
    [settings.stats, recording.stats, elapsed, u.units],
  );
  // With the tab bar hidden during a live drive, the sheet drops down into its space.
  const sheetBottom = TAB_BAR_HEIGHT + tabBarBottom(insets.bottom) + TAB_BAR_GAP + 4;
  const liveBottom = Math.max(insets.bottom, 12) + 4;
  const [drop] = useState(() => new Animated.Value(live ? 1 : 0));
  useEffect(() => {
    Animated.spring(drop, {toValue: live ? 1 : 0, useNativeDriver: true, damping: 18, stiffness: 160}).start();
  }, [live, drop]);
  const dropY = drop.interpolate({inputRange: [0, 1], outputRange: [0, sheetBottom - liveBottom]});
  // Ending hands the drive to useDriveHandoff, which opens the summary (same path as auto-end).
  const actions = {
    onStart: () => recording.start(vehicle ? {id: vehicle.id, name: vehicle.display_name} : null),
    onPause: recording.pause,
    onResume: recording.resume,
    onEnd: () => void recording.end(),
  };
  const gauge = settings.mode === 'gauge';

  return (
    <View style={{flex: 1, backgroundColor: theme.colors.canvas}}>
      {gauge ? (
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="28%" r="60%">
              <Stop offset="0" stopColor={theme.colors.accent} stopOpacity={theme.colors.glowOpacity} />
              <Stop offset="1" stopColor={theme.colors.accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#glow)" />
        </Svg>
      ) : (
        <DriveMap position={recording.position} route={recording.route} tilted={live && settings.tilt3d} headingDeg={recording.stats.headingDeg} />
      )}

      <View style={{paddingTop: insets.top + 8, gap: 10}}>
        <DriveTopBar
          live={live}
          vehicleName={vehicle?.display_name ?? 'Choose vehicle'}
          mode={settings.mode}
          tilt3d={settings.tilt3d}
          onToggle3d={() => settings.update({tilt3d: !settings.tilt3d})}
          onVehiclePress={() => setVehiclesOpen(true)}
          onModeChange={(mode) => settings.update({mode})}
          onTune={() => setCustomizeOpen(true)}
        />
        <SpeedAlertBanner />
        <EventToast event={recording.lastEvent} />
      </View>

      {settings.showCompass ? (
        // Under the tune button. Speedometer mode keeps it to the compass (no elevation).
        <View pointerEvents="none" style={{position: 'absolute', right: 9, top: insets.top + 8 + 38 + 10}}>
          <MapCompass headingDeg={recording.stats.headingDeg} moving={recording.stats.moving} altitudeM={gauge ? undefined : recording.stats.altitudeM} />
        </View>
      ) : null}

      {!gauge && settings.showCoordinates ? (
        // Under the vehicle chip (or the taller drive timer while recording), clear of the compass column.
        <View pointerEvents="none" style={{position: 'absolute', left: 16, top: insets.top + 8 + (live ? 66 : 38) + 10}}>
          <CoordinatesChip latitude={recording.position?.latitude ?? null} longitude={recording.position?.longitude ?? null} />
        </View>
      ) : null}

      {recording.permission === 'denied' ? (
        <View style={{marginHorizontal: 16, marginTop: 16, padding: 16, borderRadius: 20, backgroundColor: theme.colors.card, gap: 8}}>
          <AppText size={15} weight="extrabold">
            Location is off for DriveSense
          </AppText>
          <AppText size={13} weight="semibold" tone="secondary">
            Drive needs your location to measure speed and record the route.
          </AppText>
          <Pressable accessibilityRole="button" onPress={() => Linking.openSettings()} style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
            <AppText size={14} weight="extrabold" tone="accent">
              Open Settings
            </AppText>
            <Ionicons name="chevron-forward" size={14} color={theme.colors.accent} />
          </Pressable>
        </View>
      ) : null}

      {gauge ? (
        // Sits a little above centre, clear of the tab bar and the controls.
        <View style={{flex: 1, justifyContent: 'center', paddingBottom: (live ? liveBottom : sheetBottom) + 20}}>
          <GaugePanel
            status={recording.status}
            speed={speed}
            scale={scale}
            gaugeStyle={settings.gaugeStyle}
            accent={settings.gaugeAccent}
            stats={stats}
            {...actions}
          />
        </View>
      ) : (
        <Animated.View style={{position: 'absolute', left: SHEET_INSET, right: SHEET_INSET, bottom: sheetBottom, transform: [{translateY: dropY}]}}>
          <MapSheet width={Math.round(windowWidth - 2 * SHEET_INSET)} status={recording.status} speed={speed} scale={scale} stats={stats} {...actions} />
        </Animated.View>
      )}

      <CustomizeSheet visible={customizeOpen} onClose={() => setCustomizeOpen(false)} />
      <VehiclePickerSheet visible={vehiclesOpen} onClose={() => setVehiclesOpen(false)} />
    </View>
  );
}
