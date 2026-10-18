import {Ionicons} from '@expo/vector-icons';
import {View} from 'react-native';
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
  return (kind: ReplayEventKind) => ({rapid_acceleration: c.green, harsh_brake: c.red, overspeed: c.blue, sharp_turn: c.purple, top_speed: c.accent})[kind];
};

/** A vivid round pin with a white ring and a soft coloured glow, like Rovy's. */
export function ReplayEventMarker({kind, selected}: {kind: ReplayEventKind; selected?: boolean}) {
  const c = useAppTheme().colors;
  const color = useReplayEventColor()(kind);
  const size = selected ? 36 : 30;
  return (
    // Fixed frame so the pin stays centred on its spot when it grows on selection.
    <View style={{width: 48, height: 48, alignItems: 'center', justifyContent: 'center'}}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          borderWidth: 3,
          borderColor: c.onAccent,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: color,
          shadowOpacity: 0.55,
          shadowRadius: 8,
          shadowOffset: {width: 0, height: 3},
          elevation: 6,
        }}>
        <Ionicons name={LOOK[kind].icon} size={selected ? 17 : 14} color={c.onAccent} />
      </View>
    </View>
  );
}

export interface EventFacts {
  kind: ReplayEventKind;
  g: number | null;
  kmh: number | null;
  intensity: number | null;
  /** Into the drive, in seconds. */
  atS: number | null;
}

/** The tapped event: what it was, the G and speed at that moment, how far over, and when. */
export function ReplayEventCard({facts, onJump}: {facts: EventFacts; onJump: () => void}) {
  const c = useAppTheme().colors;
  const u = useUnits();
  const color = useReplayEventColor()(facts.kind);
  const stats: {icon: IconName; text: string}[] = [
    ...(facts.g != null ? [{icon: 'trending-up' as const, text: `${Math.abs(facts.g).toFixed(2)}g`}] : []),
    ...(facts.kmh != null ? [{icon: 'speedometer-outline' as const, text: `${kmhInUnits(facts.kmh, u.units)} ${u.speedUnit}`}] : []),
    ...(facts.intensity != null ? [{icon: 'pulse' as const, text: `${facts.intensity.toFixed(1)}×`}] : []),
    ...(facts.atS != null ? [{icon: 'time-outline' as const, text: formatClock(facts.atS)}] : []),
  ];
  return (
    <Glass radius={30} style={{flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12}}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: color,
          shadowOpacity: 0.5,
          shadowRadius: 8,
          shadowOffset: {width: 0, height: 3},
        }}>
        <Ionicons name={LOOK[facts.kind].icon} size={24} color={c.onAccent} />
      </View>
      <View style={{flex: 1, gap: 3}}>
        <AppText size={17} weight="black">
          {LOOK[facts.kind].title}
        </AppText>
        <View style={{flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 2}}>
          {stats.map((s) => (
            <View key={s.icon} style={{flexDirection: 'row', alignItems: 'center', gap: 3}}>
              <Ionicons name={s.icon} size={12} color={c.textSecondary} />
              <AppText size={13} weight="bold" tone="secondary">
                {s.text}
              </AppText>
            </View>
          ))}
        </View>
      </View>
      <MapButton icon="locate" label="Go to this moment" onPress={onJump} size={44} tint={withAlpha(color, 0.18)} />
    </Glass>
  );
}
