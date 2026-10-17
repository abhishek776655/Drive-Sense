import {Ionicons} from '@expo/vector-icons';
import {View} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {useUnits} from '../../hooks/useUnits';
import type {RecordingStatus} from '../../stores/recordingStore';
import {useAppTheme} from '../../theme/ThemeProvider';
import {bumpLayout} from '../../utils/bumpPath';
import {arcPath, clampFraction} from '../../utils/gaugeMath';
import type {StatDisplay} from '../../utils/liveStats';
import {AppText} from '../AppText';
import {RollingNumber} from '../RollingNumber';
import {BumpGlass} from './BumpGlass';
import {PrimaryControls} from './PrimaryControls';

// Vertical layout inside the sheet (y = 0 is the top of the bump).
// The bump is tall (rises 82 of its 90 radius); the arc stays its original size inside it.
const SPEED_TOP = 50;
const STATS_TOP = 142;
const READY_BUTTON_TOP = 146;
const LIVE_BUTTON_TOP = 206;
const READY_HEIGHT = 230;
const LIVE_HEIGHT = 268;
const ARC_RADIUS = 72;
const ARC_BOX = 100;

interface MapSheetProps {
  /** Sheet width, from the parent's layout. Passed in rather than measured so a remount draws at once. */
  width: number;
  status: RecordingStatus;
  /** Speed and arc full scale, both in the chosen unit. */
  speed: number;
  scale: number;
  stats: StatDisplay[];
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
}

/**
 * Glass sheet with the Rovy bump: speed arc + speed inside the bump. Ready shows no stats, so the
 * sheet is shorter; it grows to fit the four-stat row once a drive is live.
 */
export function MapSheet({width, status, speed, scale, stats, onStart, onPause, onResume, onEnd}: MapSheetProps) {
  const theme = useAppTheme();
  const {speedUnit} = useUnits();
  const ready = status === 'ready';
  const height = ready ? READY_HEIGHT : LIVE_HEIGHT;
  const layout = width > 0 ? bumpLayout(width, height) : null;
  const fraction = clampFraction(speed, scale);

  return (
    <View style={{height}}>
      {layout ? (
        <>
          <BumpGlass layout={layout} width={width} height={height} />
          <Svg width={width} height={ARC_BOX} style={{position: 'absolute', left: 0, top: 0}}>
            <Path d={arcPath(layout.center.x, layout.center.y, ARC_RADIUS, 180, 360)} fill="none" stroke={theme.colors.textPrimary} strokeOpacity={0.2} strokeWidth={6} strokeLinecap="round" />
            {fraction > 0 ? (
              <Path d={arcPath(layout.center.x, layout.center.y, ARC_RADIUS, 180, 180 + 180 * fraction)} fill="none" stroke={theme.colors.accent} strokeWidth={6} strokeLinecap="round" />
            ) : null}
          </Svg>
        </>
      ) : null}
      <View style={{position: 'absolute', left: 0, right: 0, top: SPEED_TOP, alignItems: 'center'}}>
        <RollingNumber value={speed} size={58} lineHeight={62} />
        <AppText size={12} weight="bold" tone="secondary">
          {speedUnit}
        </AppText>
      </View>
      {!ready ? (
        <View style={{position: 'absolute', left: 12, right: 12, top: STATS_TOP, flexDirection: 'row'}}>
          {stats.slice(0, 4).map((stat) => (
            <View key={stat.id} style={{flex: 1, alignItems: 'center'}}>
              <Ionicons name={stat.icon as keyof typeof Ionicons.glyphMap} size={16} color={theme.colors[stat.tone]} />
              <AppText size={20} weight="extrabold" color={stat.valueTone ? theme.colors[stat.valueTone] : undefined} style={{marginTop: 2, lineHeight: 24}}>
                {stat.value}
              </AppText>
              <AppText size={11} weight="extrabold" tone="secondary" style={{letterSpacing: 0.5}}>
                {stat.short}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
      <View style={{position: 'absolute', left: 12, right: 12, top: ready ? READY_BUTTON_TOP : LIVE_BUTTON_TOP, gap: 10}}>
        <PrimaryControls status={status} onStart={onStart} onPause={onPause} onResume={onResume} onEnd={onEnd} />
      </View>
    </View>
  );
}
