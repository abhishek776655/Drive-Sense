import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {Pressable, View} from 'react-native';
import {useShallow} from 'zustand/react/shallow';
import {useNow} from '../../hooks/useNow';
import type {DriveMode} from '../../stores/driveSettingsStore';
import {elapsedSeconds, useRecordingStore} from '../../stores/recordingStore';
import {useAppTheme} from '../../theme/ThemeProvider';
import {formatClock} from '../../utils/format';
import {AppText} from '../AppText';
import {Glass} from '../Glass';

function TimerPill() {
  const theme = useAppTheme();
  const {status, ...timing} = useRecordingStore(
    useShallow((s) => ({status: s.status, startedAt: s.startedAt, pausedMs: s.pausedMs, pausedAt: s.pausedAt})),
  );
  const now = useNow(500);
  const moving = useRecordingStore((s) => s.stats.moving);
  const paused = status === 'paused';
  // Recording splits into Moving / Idle, as the old Live tab's status badge did.
  const dot = paused ? theme.colors.amber : moving ? theme.colors.green : theme.colors.textSecondary;
  const label = paused ? 'Paused' : moving ? 'Moving' : 'Idle';
  return (
    <Glass radius={26} style={{paddingHorizontal: 16, paddingTop: 11, paddingBottom: 8, alignItems: 'center'}}>
      <AppText size={22} weight="black" style={{lineHeight: 24, letterSpacing: 0.4}}>
        {formatClock(elapsedSeconds(timing, now))}
      </AppText>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2}}>
        <View style={{width: 6, height: 6, borderRadius: 3, backgroundColor: dot}} />
        <AppText size={10} weight="bold" tone="secondary">
          {label}
        </AppText>
      </View>
    </Glass>
  );
}

function VehicleChip({name, onPress}: {name: string; onPress: () => void}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Vehicle: ${name}. Change vehicle`} onPress={onPress}>
      <Glass style={{height: 38, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6}}>
        <ColorIcon name="car-sport" size={15} />
        <AppText size={12.5} weight="extrabold" numberOfLines={1} style={{maxWidth: 170}}>
          {name}
        </AppText>
        <ColorIcon name="chevron-down" size={13} />
      </Glass>
    </Pressable>
  );
}

function ColorIcon({name, size}: {name: keyof typeof Ionicons.glyphMap; size: number}) {
  const theme = useAppTheme();
  return <Ionicons name={name} size={size} color={theme.colors.textPrimary} />;
}

interface DriveTopBarProps {
  live: boolean;
  vehicleName: string;
  mode: DriveMode;
  tilt3d: boolean;
  onToggle3d: () => void;
  onVehiclePress: () => void;
  onModeChange: (mode: DriveMode) => void;
  onTune: () => void;
}

/** Vehicle chip (Ready) or timer pill (live) on the left; Map | Gauge toggle, the cluster (live) and tune on the right. */
export function DriveTopBar({live, vehicleName, mode, tilt3d, onToggle3d, onVehiclePress, onModeChange, onTune}: DriveTopBarProps) {
  const theme = useAppTheme();
  const segment = (value: DriveMode, icon: keyof typeof Ionicons.glyphMap, label: string) => {
    const on = mode === value;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{selected: on}}
        onPress={() => onModeChange(value)}
        style={{width: 32, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? theme.colors.accent : 'transparent'}}>
        <Ionicons name={icon} size={16} color={on ? theme.colors.onAccent : theme.colors.textPrimary} />
      </Pressable>
    );
  };
  return (
    <View style={{flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 12}}>
      {live ? <TimerPill /> : <VehicleChip name={vehicleName} onPress={onVehiclePress} />}
      <View style={{flexDirection: 'row', gap: 6}}>
        {/* The tilt only applies to a live drive on the map, so the switch only shows then. */}
        {live && mode === 'map' ? (
          <Pressable accessibilityRole="switch" accessibilityLabel="3D map" accessibilityState={{checked: tilt3d}} onPress={onToggle3d}>
            <Glass style={{height: 38, minWidth: 46, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center'}}>
              <AppText size={13} weight="black" color={tilt3d ? theme.colors.accent : theme.colors.textPrimary}>
                {tilt3d ? '3D' : '2D'}
              </AppText>
            </Glass>
          </Pressable>
        ) : null}
        <Glass style={{height: 38, flexDirection: 'row', alignItems: 'center', padding: 4, gap: 2}}>
          {segment('map', 'map', 'Map mode')}
          {segment('gauge', 'speedometer', 'Gauge mode')}
        </Glass>
        {/* During a drive, one tap to the full-screen landscape cluster. */}
        {live ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Open cluster" onPress={() => router.push('/cluster')}>
            <Glass style={{width: 38, height: 38, alignItems: 'center', justifyContent: 'center'}}>
              <Ionicons name="tv-outline" size={18} color={theme.colors.textPrimary} />
            </Glass>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Customize" onPress={onTune}>
          <Glass style={{width: 38, height: 38, alignItems: 'center', justifyContent: 'center'}}>
            <Ionicons name="options" size={18} color={theme.colors.textPrimary} />
          </Glass>
        </Pressable>
      </View>
    </View>
  );
}
