import React from 'react';
import {Pressable, Text, View} from 'react-native';
import {useAppTheme} from '../theme/appTheme';

export interface SegmentedTabOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedTabsProps<T extends string> {
  options: ReadonlyArray<SegmentedTabOption<T>>;
  value: T;
  onChange: (next: T) => void;
  accessibilityLabel?: string;
}

/** Minimum tap target. Matches the 44pt floor used across the app's pressables. */
const HIT = 36;

export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedTabsProps<T>) {
  const theme = useAppTheme();

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      className="flex-row rounded-full p-1"
      style={{backgroundColor: theme.cardSoft}}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{selected: active}}
            accessibilityLabel={option.label}
            className="rounded-full px-3"
            style={{
              backgroundColor: active ? theme.card : 'transparent',
              minHeight: HIT,
              justifyContent: 'center',
            }}>
            <Text
              style={{
                color: active ? theme.text : theme.textSubtle,
                ...theme.typography.caption,
                fontWeight: '700',
              }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
