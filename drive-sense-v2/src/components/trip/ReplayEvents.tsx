import {Ionicons} from '@expo/vector-icons';
import {useEffect, useState} from 'react';
import {Animated, View} from 'react-native';
import {useUnits} from '../../hooks/useUnits';
import {withAlpha} from '../../theme/color';
import {useAppTheme} from '../../theme/ThemeProvider';
import {formatClock} from '../../utils/format';
import {kmhInUnits} from '../../utils/units';
import {AppText} from '../AppText';
import {Glass} from '../Glass';
import {MapButton} from './MapButton';

type IconName = keyof typeof Ionicons.glyphMap;

/** The replay's markers: the three driving events plus the drive's top speed. */
export type ReplayEventKind = 'rapid_acceleration' | 'harsh_brake' | 'overspeed' | 'sharp_turn' | 'top_speed';

const LOOK: Record<ReplayEventKind, {icon: IconName; title: string}> = {
  rapid_acceleration: {icon: 'flash', title: 'Acceleration'},
  harsh_brake: {icon: 'alert', title: 'Hard braking'},
  overspeed: {icon: 'speedometer', title: 'Speeding'},
  sharp_turn: {icon: 'return-up-forward', title: 'Sharp turn'},
  top_speed: {icon: 'rocket', title: 'Top speed'},
};

export const useReplayEventColor = () => {
  const c = useAppTheme().colors;
  return (kind: ReplayEventKind) =>
    ({rapid_acceleration: c.green, harsh_brake: c.red, overspeed: c.blue, sharp_turn: c.purple, top_speed: c.accent})[kind];
};


export interface EventFacts {
  kind: ReplayEventKind;
  g: number | null;
  kmh: number | null;
  intensity: number | null;
  /** Into the drive, in seconds. */
  atS: number | null;
}

/**
 * The tapped event: what it was, the G and speed at that moment, how far over, and when.
 *
 * Callers must pass `key={selectedId}` so React re-mounts this component on every event
 * switch, which replays the entrance animations automatically.
 */
export function ReplayEventCard({facts, onJump, onClose}: {facts: EventFacts; onJump: () => void; onClose?: () => void}) {
  const c = useAppTheme().colors;
  const u = useUnits();
  const color = useReplayEventColor()(facts.kind);
  const stats: {icon: IconName; text: string}[] = [
    ...(facts.g != null ? [{icon: 'trending-up' as const, text: `${Math.abs(facts.g).toFixed(2)}g`}] : []),
    ...(facts.kmh != null ? [{icon: 'speedometer-outline' as const, text: `${kmhInUnits(facts.kmh, u.units)} ${u.speedUnit}`}] : []),
    ...(facts.intensity != null ? [{icon: 'pulse' as const, text: `${facts.intensity.toFixed(1)}×`}] : []),
    ...(facts.atS != null ? [{icon: 'time-outline' as const, text: formatClock(facts.atS)}] : []),
  ];

  // Icon circle: scale + fade in on mount (0.65 → 1).
  const [iconAnim] = useState(() => new Animated.Value(0));
  // Text block: slide in from right + fade (translateX 10 → 0) — slight delay after icon.
  const [textAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.parallel([
      Animated.spring(iconAnim, {toValue: 1, tension: 260, friction: 18, useNativeDriver: true}),
      Animated.sequence([
        Animated.delay(40),
        Animated.spring(textAnim, {toValue: 1, tension: 200, friction: 22, useNativeDriver: true}),
      ]),
    ]).start();
    // Mount-only — callers re-mount via key={selectedId} to replay animations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Glass clear tint={withAlpha(c.canvas, 0.22)} radius={24} style={{flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10}}>
      <Animated.View
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: color,
          shadowOpacity: 0.5,
          shadowRadius: 6,
          shadowOffset: {width: 0, height: 2},
          opacity: iconAnim,
          transform: [{scale: iconAnim.interpolate({inputRange: [0, 1], outputRange: [0.65, 1]})}],
        }}>
        <Ionicons name={LOOK[facts.kind].icon} size={20} color={c.onAccent} />
      </Animated.View>
      <Animated.View
        style={{
          flex: 1,
          gap: 2,
          opacity: textAnim,
          transform: [{translateX: textAnim.interpolate({inputRange: [0, 1], outputRange: [10, 0]})}],
        }}>
        <AppText size={14} weight="black">
          {LOOK[facts.kind].title}
        </AppText>
        <View style={{flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 1}}>
          {stats.map((s) => (
            <View key={s.icon} style={{flexDirection: 'row', alignItems: 'center', gap: 2}}>
              <Ionicons name={s.icon} size={10} color={c.textSecondary} />
              <AppText size={11} weight="bold" tone="secondary">
                {s.text}
              </AppText>
            </View>
          ))}
        </View>
      </Animated.View>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
        <MapButton icon="locate" label="Go to this moment" onPress={onJump} size={36} tint={withAlpha(color, 0.18)} />
        {onClose ? <MapButton icon="close" label="Close" onPress={onClose} size={30} /> : null}
      </View>
    </Glass>
  );
}
