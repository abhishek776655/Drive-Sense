import {Ionicons} from '@expo/vector-icons';
import {View} from 'react-native';
import type {GaugeStyle} from '../../stores/driveSettingsStore';
import type {RecordingStatus} from '../../stores/recordingStore';
import {useAppTheme} from '../../theme/ThemeProvider';
import type {StatDisplay} from '../../utils/liveStats';
import {AppText} from '../AppText';
import {GaugeDial} from './GaugeDial';
import {PrimaryControls} from './PrimaryControls';

interface GaugePanelProps {
  status: RecordingStatus;
  /** In the chosen unit, as GaugeDial takes them. */
  speed: number;
  scale: number;
  gaugeStyle: GaugeStyle;
  accent: string;
  stats: StatDisplay[];
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
}

/** Dial, 3 × 2 stat tiles (hidden in Ready) and the primary control. */
export function GaugePanel({status, speed, scale, gaugeStyle, accent, stats, ...actions}: GaugePanelProps) {
  const theme = useAppTheme();
  const ready = status === 'ready';
  return (
    <View style={{alignItems: 'center', paddingHorizontal: 12, gap: 14}}>
      <GaugeDial speed={speed} scale={scale} gaugeStyle={gaugeStyle} accent={accent} size={230} />
      {!ready ? (
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignSelf: 'stretch'}}>
          {stats.slice(0, 6).map((stat) => (
            <View
              key={stat.id}
              style={{width: '32%', flexGrow: 1, height: 66, borderRadius: 20, backgroundColor: theme.colors.card, paddingHorizontal: 10, justifyContent: 'center'}}>
              <AppText size={10} weight="extrabold" tone="secondary" style={{letterSpacing: 0.5}}>
                {stat.label}
              </AppText>
              <AppText size={18} weight="extrabold" color={stat.valueTone ? theme.colors[stat.valueTone] : undefined} numberOfLines={1}>
                {stat.value}
                {stat.unit ? (
                  <AppText size={10} weight="bold" tone="secondary">
                    {' '}
                    {stat.unit}
                  </AppText>
                ) : null}
              </AppText>
              <Ionicons
                name={stat.icon as keyof typeof Ionicons.glyphMap}
                size={16}
                color={theme.colors[stat.tone]}
                style={{position: 'absolute', right: 9, top: 25}}
              />
            </View>
          ))}
        </View>
      ) : null}
      {/* At Ready the dial stands alone, so Start sits lower, clear of it. */}
      <View style={{alignSelf: 'stretch', marginTop: ready ? 40 : 0}}>
        <PrimaryControls status={status} {...actions} />
      </View>
    </View>
  );
}
