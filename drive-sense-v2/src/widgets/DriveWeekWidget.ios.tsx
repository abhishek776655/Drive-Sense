import {HStack, RoundedRectangle, Spacer, Text, VStack} from '@expo/ui/swift-ui';
import {font, foregroundStyle, frame, padding} from '@expo/ui/swift-ui/modifiers';
import {createWidget, type WidgetEnvironment} from 'expo-widgets';
import type {DriveWeekProps} from './props';

/**
 * This week's driving (spec 2026-10-17, CarPlay Live Activity). Small, the size CarPlay shows:
 * distance, drives and score over a Monday–Sunday bar strip. Medium adds the last drive. Runs in the
 * widget runtime: no imports, no theme, every constant inside the function.
 */
const DriveWeekWidget = (props: DriveWeekProps, environment: WidgetEnvironment) => {
  'widget';
  const accent = environment.widgetRenderingMode === 'fullColor' || environment.widgetRenderingMode == null ? '#FF6D00' : '#FFFFFF';
  const muted = '#8E8E93';
  const barIdle = environment.colorScheme === 'dark' ? '#3A3A3C' : '#D1D1D6';

  if (!props.signedIn) {
    return (
      <VStack spacing={6}>
        <Text modifiers={[font({size: 15, weight: 'bold'})]}>DriveSense</Text>
        <Text modifiers={[font({size: 12, weight: 'medium'}), foregroundStyle(muted)]}>Sign in to see your week</Text>
      </VStack>
    );
  }

  const week = (
    <VStack alignment="leading" spacing={4}>
      <Text modifiers={[font({size: 11, weight: 'semibold'}), foregroundStyle(accent)]}>THIS WEEK</Text>
      <HStack spacing={3} alignment="firstTextBaseline">
        <Text modifiers={[font({size: 30, weight: 'heavy', design: 'rounded'})]}>{props.distance}</Text>
        <Text modifiers={[font({size: 13, weight: 'semibold'}), foregroundStyle(muted)]}>{props.unit}</Text>
      </HStack>
      <HStack spacing={4}>
        <Text modifiers={[font({size: 12, weight: 'medium'}), foregroundStyle(muted)]}>{props.drives} · Score</Text>
        <Text modifiers={[font({size: 12, weight: 'bold'}), foregroundStyle(accent)]}>{props.score}</Text>
      </HStack>
      <Spacer />
      <HStack spacing={5} alignment="bottom">
        {props.bars.map((value, i) => (
          <RoundedRectangle
            key={i}
            cornerRadius={2}
            modifiers={[frame({width: 9, height: 4 + value * 30}), foregroundStyle(i === props.today ? accent : barIdle)]}
          />
        ))}
      </HStack>
    </VStack>
  );

  if (environment.widgetFamily !== 'systemMedium' || props.last == null) {
    return week;
  }

  return (
    <HStack spacing={16} alignment="top">
      {week}
      <VStack alignment="leading" spacing={4} modifiers={[padding({top: 2})]}>
        <Text modifiers={[font({size: 11, weight: 'semibold'}), foregroundStyle(muted)]}>LAST DRIVE</Text>
        <Text modifiers={[font({size: 15, weight: 'bold'})]}>{props.last.route}</Text>
        <Text modifiers={[font({size: 12, weight: 'medium'}), foregroundStyle(muted)]}>{props.last.detail}</Text>
        <Spacer />
      </VStack>
      <Spacer />
    </HStack>
  );
};

export default createWidget('DriveWeek', DriveWeekWidget);
