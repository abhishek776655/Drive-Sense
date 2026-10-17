import {Circle, HStack, Image, Spacer, Text, VStack, ZStack} from '@expo/ui/swift-ui';
import {font, foregroundStyle, frame, padding, strokeBorder} from '@expo/ui/swift-ui/modifiers';
import {createLiveActivity, type LiveActivityEnvironment} from 'expo-widgets';
import type {DriveActivityProps} from './props';

/**
 * The drive's Live Activity: Lock Screen banner, Dynamic Island and, through `bannerSmall`, the
 * CarPlay Dashboard (spec 2026-10-17, CarPlay Live Activity). Runs in the widget runtime, so every
 * constant lives inside the function and colours are written out (no theme, no imports).
 */
const DriveActivity = (props: DriveActivityProps, environment: LiveActivityEnvironment) => {
  'widget';
  const accent = environment.isLuminanceReduced ? '#FFFFFF' : '#FF6D00';
  const muted = '#9A9AA0';
  const saved = props.state === 'saved';
  const title = saved ? 'Drive saved' : props.state === 'paused' ? 'Paused' : 'Recording drive';
  const dot = saved ? 'checkmark.circle.fill' : props.state === 'paused' ? 'pause.circle.fill' : 'record.circle';

  const stat = (value: string, label: string) => (
    <VStack alignment="leading" spacing={1}>
      <Text modifiers={[font({size: 22, weight: 'bold', design: 'rounded'})]}>{value}</Text>
      <Text modifiers={[font({size: 11, weight: 'medium'}), foregroundStyle(muted)]}>{label}</Text>
    </VStack>
  );

  const scoreRing = (size: number) => (
    <ZStack>
      <Circle modifiers={[strokeBorder({color: accent, style: {lineWidth: size / 11}}), frame({width: size, height: size})]} />
      <Text modifiers={[font({size: size * 0.36, weight: 'bold', design: 'rounded'})]}>{props.score}</Text>
    </ZStack>
  );

  const header = (
    <HStack spacing={6}>
      <Image systemName={dot} color={accent} size={13} />
      <Text modifiers={[font({size: 13, weight: 'semibold'})]}>{title}</Text>
      <Spacer />
      <Text modifiers={[font({size: 12, weight: 'medium'}), foregroundStyle(muted)]}>DriveSense</Text>
    </HStack>
  );

  return {
    banner: (
      <VStack alignment="leading" spacing={10} modifiers={[padding({all: 14})]}>
        {header}
        <HStack spacing={18} alignment="bottom">
          {stat(props.time, saved ? props.events || 'time' : 'time')}
          {stat(props.distance, 'distance')}
          {stat(props.avgSpeed, 'avg')}
          <Spacer />
          <VStack spacing={2}>
            {scoreRing(44)}
            <Text modifiers={[font({size: 11, weight: 'medium'}), foregroundStyle(muted)]}>score</Text>
          </VStack>
        </HStack>
      </VStack>
    ),
    // CarPlay Dashboard and the Watch Smart Stack: one glance, three facts.
    bannerSmall: (
      <VStack alignment="leading" spacing={4} modifiers={[padding({all: 10})]}>
        <HStack spacing={5}>
          <Image systemName={dot} color={accent} size={11} />
          <Text modifiers={[font({size: 12, weight: 'semibold'})]}>{saved ? 'Drive saved' : props.state === 'paused' ? 'Paused' : 'Recording'}</Text>
        </HStack>
        <Text modifiers={[font({size: 22, weight: 'bold', design: 'rounded'})]}>{props.distance}</Text>
        <HStack spacing={4}>
          <Text modifiers={[font({size: 12, weight: 'medium'}), foregroundStyle(muted)]}>{saved ? props.events : props.time}</Text>
          <Text modifiers={[font({size: 12, weight: 'medium'}), foregroundStyle(muted)]}>· Score</Text>
          <Text modifiers={[font({size: 12, weight: 'bold'}), foregroundStyle(accent)]}>{props.score}</Text>
        </HStack>
      </VStack>
    ),
    compactLeading: (
      <HStack spacing={4}>
        <Image systemName={dot} color={accent} size={12} />
        <Text modifiers={[font({size: 13, weight: 'semibold', design: 'rounded'})]}>{props.time}</Text>
      </HStack>
    ),
    compactTrailing: <Text modifiers={[font({size: 13, weight: 'semibold', design: 'rounded'})]}>{props.distance}</Text>,
    minimal: <Image systemName={dot} color={accent} size={12} />,
    expandedLeading: (
      <VStack alignment="leading" spacing={8} modifiers={[padding({leading: 6, top: 6})]}>
        {stat(props.time, 'time')}
        {stat(props.distance, 'distance')}
      </VStack>
    ),
    expandedTrailing: <VStack modifiers={[padding({trailing: 6, top: 6})]}>{scoreRing(48)}</VStack>,
    expandedBottom: (
      <HStack spacing={6} modifiers={[padding({horizontal: 6, bottom: 4})]}>
        <Image systemName={dot} color={accent} size={12} />
        <Text modifiers={[font({size: 13, weight: 'semibold'})]}>{title}</Text>
        <Spacer />
        <Text modifiers={[font({size: 13, weight: 'medium'}), foregroundStyle(muted)]}>avg {props.avgSpeed}</Text>
      </HStack>
    ),
  };
};

export default createLiveActivity('DriveActivity', DriveActivity);
