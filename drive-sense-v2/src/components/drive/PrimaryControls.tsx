import {Ionicons} from '@expo/vector-icons';
import {useEffect, useState, type ReactNode} from 'react';
import {Animated, Easing, Pressable, View} from 'react-native';
import {useUnits} from '../../hooks/useUnits';
import {usePreferencesStore} from '../../stores/preferencesStore';
import type {RecordingStatus} from '../../stores/recordingStore';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AUTO_START_SPEED_MPS} from '../../utils/autoTrip';
import {AppText} from '../AppText';
import {Glass} from '../Glass';
import {hasLiquidGlass} from '../../theme/liquidGlass';

type IconName = keyof typeof Ionicons.glyphMap;

const HEIGHT = 48;
const GAP = 8;
/** Duration of the End button opening / closing and of the label crossfade. */
const MORPH_MS = 340;

/** Springs down a little while held. Its own view, so it never mixes with the layout animation. */
function PressScale({children, onPress, label, disabled}: {children: ReactNode; onPress: () => void; label: string; disabled?: boolean}) {
  const [scale] = useState(() => new Animated.Value(1));
  const spring = (toValue: number) => Animated.spring(scale, {toValue, useNativeDriver: true, damping: 18, stiffness: 260, mass: 0.8}).start();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => spring(0.96)}
      onPressOut={() => spring(1)}
      style={{flex: 1}}>
      <Animated.View style={{flex: 1, transform: [{scale}]}}>{children}</Animated.View>
    </Pressable>
  );
}

/** Icon + label that fades and rises in whenever it changes, so the button morphs instead of jumping. */
function MorphLabel({icon, label, color}: {icon: IconName; label: string; color: string}) {
  const [appear] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(appear, {toValue: 1, duration: MORPH_MS * 0.7, easing: Easing.out(Easing.cubic), useNativeDriver: true}).start();
  }, [appear]);
  return (
    <Animated.View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        opacity: appear,
        transform: [{translateY: appear.interpolate({inputRange: [0, 1], outputRange: [6, 0]})}],
      }}>
      <Ionicons name={icon} size={18} color={color} />
      <AppText size={18} weight="black" color={color} numberOfLines={1}>
        {label}
      </AppText>
    </Animated.View>
  );
}

interface PrimaryControlsProps {
  status: RecordingStatus;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
}

/**
 * Start → Pause → Resume / End as one control that morphs: the main button stays put while its label
 * crossfades, and on Pause the End button grows in from the right as the main one narrows. End only
 * exists while paused, so a stray tap cannot end a live trip.
 */
export function PrimaryControls({status, onStart, onPause, onResume, onEnd}: PrimaryControlsProps) {
  const theme = useAppTheme();
  const [width, setWidth] = useState(0);
  const paused = status === 'paused';
  const [open] = useState(() => new Animated.Value(paused ? 1 : 0));

  useEffect(() => {
    Animated.timing(open, {
      toValue: paused ? 1 : 0,
      duration: MORPH_MS,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      // Width cannot run on the native driver; the row is two views, so the JS thread copes easily.
      useNativeDriver: false,
    }).start();
  }, [paused, open]);

  const main =
    status === 'ready'
      ? {label: 'Start Drive', icon: 'play' as IconName, onPress: onStart}
      : status === 'recording'
        ? {label: 'Pause', icon: 'pause' as IconName, onPress: onPause}
        : {label: 'Resume', icon: 'play' as IconName, onPress: onResume};

  const glass = hasLiquidGlass();
  const half = Math.max(0, (width - GAP) / 2);
  const endWidth = open.interpolate({inputRange: [0, 1], outputRange: [0, half]});
  const endGap = open.interpolate({inputRange: [0, 1], outputRange: [0, GAP]});

  return (
    <View style={{flexDirection: 'row', height: HEIGHT}} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={{flex: 1}}>
        <PressScale label={main.label} onPress={main.onPress}>
          {glass ? (
            // iOS 26: orange Liquid Glass, as every primary action in the app.
            <Glass interactive tint={theme.colors.accent} radius={HEIGHT / 2} style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
              <MorphLabel key={main.label} icon={main.icon} label={main.label} color={theme.colors.onAccent} />
            </Glass>
          ) : (
            <View
              style={{
                flex: 1,
                borderRadius: HEIGHT / 2,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.accent,
                shadowColor: theme.colors.accent,
                shadowOpacity: 0.4,
                shadowRadius: 12,
                shadowOffset: {width: 0, height: 6},
              }}>
              <MorphLabel key={main.label} icon={main.icon} label={main.label} color={theme.colors.onAccent} />
            </View>
          )}
        </PressScale>
      </View>
      <Animated.View style={{width: endWidth, marginLeft: endGap, opacity: open, overflow: 'hidden'}} pointerEvents={paused ? 'auto' : 'none'}>
        <PressScale label="End" onPress={onEnd} disabled={!paused}>
          <Glass
            interactive
            radius={HEIGHT / 2}
            style={{flex: 1, minWidth: half, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8}}>
            <Ionicons name="stop" size={18} color={theme.colors.red} />
            <AppText size={18} weight="black" color={theme.colors.red}>
              End
            </AppText>
          </Glass>
        </PressScale>
      </Animated.View>
    </View>
  );
}

/** Shown only while auto-start is on (Settings): otherwise the line would promise a start that won't come. */
export function AutoStartLine() {
  const theme = useAppTheme();
  const u = useUnits();
  const autoStart = usePreferencesStore((s) => s.autoStart);
  if (!autoStart) {
    return null;
  }
  return (
    <View style={{flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6}}>
      <View style={{width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.green}} />
      <AppText size={11} weight="bold" tone="secondary">
        Auto-start on · begins above {u.speed(AUTO_START_SPEED_MPS)} {u.speedUnit}
      </AppText>
    </View>
  );
}
