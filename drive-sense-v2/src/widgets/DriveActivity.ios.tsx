import {Gauge, HStack, Image, Spacer, Text, VStack} from '@expo/ui/swift-ui';
import {font, foregroundStyle, frame, gaugeStyle, minimumScaleFactor, monospacedDigit, padding, tint} from '@expo/ui/swift-ui/modifiers';
import {createLiveActivity, type LiveActivityEnvironment} from 'expo-widgets';
import type {DriveActivityProps} from './props';

/**
 * The drive's Live Activity: Lock Screen banner, Dynamic Island and, through `bannerSmall`, the
 * CarPlay Dashboard (spec 2026-10-17, CarPlay Live Activity). Runs in the widget runtime, so every
 * constant lives inside the function and colours are written out (no theme, no imports).
 *
 * Layout: the state in its own colour (recording orange, paused amber, saved green) with the time on
 * the right; distance as the hero with the score as a circular gauge beside it; time, average speed
 * and (once saved) events as a row of small figures under it.
 */
const DriveActivity = (props: DriveActivityProps, environment: LiveActivityEnvironment) => {
  'widget';
  const dim = environment.isLuminanceReduced;
  const saved = props.state === 'saved';
  const paused = props.state === 'paused';
  // Always-on display: no colour, just white on the dimmed screen.
  const stateColor = dim ? '#FFFFFF' : saved ? '#34C759' : paused ? '#FFB340' : '#FF6D00';
  const accent = dim ? '#FFFFFF' : '#FF6D00';
  const muted = '#9A9AA0';
  const title = saved ? 'Drive saved' : paused ? 'Paused' : 'Recording';
  const dot = saved ? 'checkmark.circle.fill' : paused ? 'pause.circle.fill' : 'record.circle';
  const scoreValue = Number(props.score);
  const hasScore = Number.isFinite(scoreValue);

  const rounded = (size: number, weight: 'bold' | 'semibold' | 'heavy' = 'bold') => font({size, weight, design: 'rounded'});

  // A small figure with its symbol: "⏱ 23:41".
  const fact = (symbol: 'gauge.with.needle' | 'timer' | 'exclamationmark.triangle', value: string) => (
    <HStack spacing={4}>
      <Image systemName={symbol} color={muted} size={11} />
      <Text modifiers={[rounded(14, 'semibold'), monospacedDigit()]}>{value}</Text>
    </HStack>
  );

  // The score as SwiftUI's circular gauge, 0–100, the figure inside.
  const scoreGauge = (size: number) => (
    <Gauge
      value={hasScore ? scoreValue : 0}
      min={0}
      max={100}
      currentValueLabel={<Text modifiers={[rounded(size * 0.34, 'heavy'), monospacedDigit()]}>{props.score}</Text>}
      modifiers={[gaugeStyle('circularCapacity'), tint(accent), frame({width: size, height: size})]}
    />
  );

  const stateLabel = (size: number) => (
    <HStack spacing={5}>
      <Image systemName={dot} color={stateColor} size={size} />
      <Text modifiers={[font({size: size + 1, weight: 'semibold'}), foregroundStyle(stateColor)]}>{title}</Text>
    </HStack>
  );

  return {
    banner: (
      <VStack alignment="leading" spacing={8} modifiers={[padding({horizontal: 16, vertical: 14})]}>
        <HStack>
          {stateLabel(13)}
          <Spacer />
          <Text modifiers={[rounded(15, 'semibold'), monospacedDigit(), foregroundStyle(muted)]}>{props.time}</Text>
        </HStack>
        <HStack alignment="center" spacing={12}>
          <VStack alignment="leading" spacing={2}>
            <Text modifiers={[rounded(34, 'heavy'), monospacedDigit(), minimumScaleFactor(0.7)]}>{props.distance}</Text>
            <HStack spacing={14}>
              {fact('gauge.with.needle', props.avgSpeed)}
              {saved ? fact('exclamationmark.triangle', props.events) : fact('timer', props.time)}
            </HStack>
          </VStack>
          <Spacer />
          <VStack spacing={3}>
            {scoreGauge(52)}
            <Text modifiers={[font({size: 10, weight: 'semibold'}), foregroundStyle(muted)]}>SCORE</Text>
          </VStack>
        </HStack>
      </VStack>
    ),
    // CarPlay Dashboard and the Watch Smart Stack: one glance, three facts.
    bannerSmall: (
      <VStack alignment="leading" spacing={4} modifiers={[padding({all: 10})]}>
        {stateLabel(11)}
        <Text modifiers={[rounded(24, 'heavy'), monospacedDigit(), minimumScaleFactor(0.7)]}>{props.distance}</Text>
        <HStack spacing={6}>
          <Text modifiers={[rounded(12, 'semibold'), monospacedDigit(), foregroundStyle(muted)]}>{saved ? props.events : props.time}</Text>
          <Spacer />
          <Text modifiers={[rounded(12, 'bold'), foregroundStyle(accent)]}>{`★ ${props.score}`}</Text>
        </HStack>
      </VStack>
    ),
    compactLeading: (
      <HStack spacing={4}>
        <Image systemName={dot} color={stateColor} size={12} />
        <Text modifiers={[rounded(13, 'semibold'), monospacedDigit()]}>{props.time}</Text>
      </HStack>
    ),
    compactTrailing: <Text modifiers={[rounded(13, 'semibold'), monospacedDigit(), foregroundStyle(accent)]}>{props.distance}</Text>,
    minimal: <Image systemName={dot} color={stateColor} size={12} />,
    expandedLeading: (
      <VStack alignment="leading" spacing={2} modifiers={[padding({leading: 6, top: 6})]}>
        <Text modifiers={[font({size: 11, weight: 'semibold'}), foregroundStyle(muted)]}>DISTANCE</Text>
        <Text modifiers={[rounded(28, 'heavy'), monospacedDigit(), minimumScaleFactor(0.7)]}>{props.distance}</Text>
      </VStack>
    ),
    expandedTrailing: <VStack modifiers={[padding({trailing: 6, top: 6})]}>{scoreGauge(50)}</VStack>,
    expandedBottom: (
      <HStack spacing={12} modifiers={[padding({horizontal: 6, bottom: 4})]}>
        {stateLabel(12)}
        <Spacer />
        {fact('timer', props.time)}
        {fact('gauge.with.needle', props.avgSpeed)}
      </HStack>
    ),
  };
};

export default createLiveActivity('DriveActivity', DriveActivity);
