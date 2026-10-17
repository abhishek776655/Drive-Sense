import {Ionicons} from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {useEffect, useState, type ReactNode} from 'react';
import {ActivityIndicator, Animated, Pressable, TextInput, View, type KeyboardTypeOptions, type TextInputProps} from 'react-native';
import {matchOptions} from '../../data/vehicleCatalog';
import {withAlpha} from '../../theme/color';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';

/** Rovy's white pill on the accent: dark-accent label, shrinks under the finger, dims until valid. */
export function PillButton({label, onPress, disabled, busy}: {label: string; onPress: () => void; disabled?: boolean; busy?: boolean}) {
  const c = useAppTheme().colors;
  const [press] = useState(() => new Animated.Value(1));
  const to = (value: number) => Animated.spring(press, {toValue: value, damping: 15, stiffness: 300, useNativeDriver: true}).start();
  const inactive = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled: inactive, busy}}
      disabled={inactive}
      onPress={onPress}
      onPressIn={() => to(0.97)}
      onPressOut={() => to(1)}>
      <Animated.View
        style={{
          height: 60,
          borderRadius: 30,
          backgroundColor: c.onAccent,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.55 : 1,
          transform: [{scale: press}],
        }}>
        {busy ? (
          <ActivityIndicator color={c.accentDeep} />
        ) : (
          <AppText size={19} weight="black" color={c.accentDeep}>
            {label}
          </AppText>
        )}
      </Animated.View>
    </Pressable>
  );
}

/** Quiet text button under the pill ("Skip", "Not now"). */
export function GhostButton({label, onPress}: {label: string; onPress: () => void}) {
  const c = useAppTheme().colors;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({pressed}) => ({alignItems: 'center', padding: 12, opacity: pressed ? 0.6 : 1})}>
      <AppText size={15} weight="extrabold" color={withAlpha(c.onAccent, 0.85)}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Round translucent back chip. */
export function BackChip({onPress}: {onPress: () => void}) {
  const c = useAppTheme().colors;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={onPress}
      hitSlop={10}
      style={({pressed}) => ({
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: withAlpha(c.onAccent, pressed ? 0.28 : 0.18),
        alignItems: 'center',
        justifyContent: 'center',
      })}>
      <Ionicons name="chevron-back" size={22} color={c.onAccent} />
    </Pressable>
  );
}

/** Thin bar across the top that glides to the current step. */
export function ProgressBar({step, total}: {step: number; total: number}) {
  const c = useAppTheme().colors;
  const [width] = useState(() => new Animated.Value(step / total));
  useEffect(() => {
    Animated.spring(width, {toValue: step / total, damping: 20, stiffness: 120, useNativeDriver: false}).start();
  }, [step, total, width]);
  return (
    <View style={{flex: 1, height: 4, borderRadius: 2, backgroundColor: withAlpha(c.onAccent, 0.22), overflow: 'hidden'}}>
      <Animated.View
        style={{height: 4, borderRadius: 2, backgroundColor: c.onAccent, width: width.interpolate({inputRange: [0, 1], outputRange: ['0%', '100%']})}}
      />
    </View>
  );
}

/**
 * A big tappable option card. Picked: white with dark-accent text and a check that pops in; not
 * picked: a translucent pane. Picking springs the card and ticks the selection haptic.
 */
export function ChoiceCard({
  title,
  subtitle,
  icon,
  selected,
  onPress,
}: {
  title: string;
  subtitle?: string;
  icon?: (color: string) => ReactNode;
  selected: boolean;
  onPress: () => void;
}) {
  const c = useAppTheme().colors;
  const [pop] = useState(() => new Animated.Value(selected ? 1 : 0));
  useEffect(() => {
    Animated.spring(pop, {toValue: selected ? 1 : 0, damping: 12, stiffness: 220, useNativeDriver: true}).start();
  }, [selected, pop]);
  const ink = selected ? c.accentDeep : c.onAccent;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{selected}}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}>
      <Animated.View
        style={{
          minHeight: subtitle ? 84 : 96,
          borderRadius: 30,
          paddingHorizontal: 22,
          paddingVertical: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
          backgroundColor: selected ? c.onAccent : withAlpha(c.onAccent, 0.1),
          borderWidth: 1.5,
          borderColor: selected ? c.onAccent : withAlpha(c.onAccent, 0.2),
          transform: [{scale: pop.interpolate({inputRange: [0, 1], outputRange: [1, 1.02]})}],
        }}>
        {icon ? (
          <View
            style={{
              width: 58,
              height: 58,
              borderRadius: 29,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? 'transparent' : withAlpha(c.onAccent, 0.14),
            }}>
            {icon(ink)}
          </View>
        ) : null}
        <View style={{flex: 1, gap: 2}}>
          <AppText size={subtitle ? 20 : 26} weight="black" color={ink}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText size={15} weight="semibold" color={selected ? c.accentDeep : withAlpha(c.onAccent, 0.8)}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            borderWidth: selected ? 0 : 2,
            borderColor: withAlpha(c.onAccent, 0.55),
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Animated.View
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: c.accentDeep,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pop,
              transform: [{scale: pop}],
            }}>
            <Ionicons name="checkmark" size={18} color={c.onAccent} />
          </Animated.View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

/**
 * Rovy's form line: an arrow while empty that turns into a check once valid, big white text, a
 * hairline under it, and an optional note on the right ("Available", "Taken").
 */
export function LineField({
  value,
  onChangeText,
  placeholder,
  valid,
  note,
  secure,
  keyboardType,
  autoFocus,
  textContentType,
  onSubmitEditing,
  returnKeyType,
  maxLength,
  autoCapitalize = 'none',
  onFocus,
  onBlur,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  valid: boolean;
  note?: string;
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoFocus?: boolean;
  textContentType?: TextInputProps['textContentType'];
  onSubmitEditing?: () => void;
  returnKeyType?: TextInputProps['returnKeyType'];
  maxLength?: number;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const [tick] = useState(() => new Animated.Value(valid ? 1 : 0));
  useEffect(() => {
    Animated.spring(tick, {toValue: valid ? 1 : 0, damping: 14, stiffness: 220, useNativeDriver: true}).start();
  }, [valid, tick]);
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: withAlpha(c.onAccent, 0.18)}}>
      <View style={{width: 30, height: 30, alignItems: 'center', justifyContent: 'center'}}>
        <Animated.View style={{position: 'absolute', opacity: tick.interpolate({inputRange: [0, 1], outputRange: [1, 0]})}}>
          <Ionicons name="arrow-forward" size={26} color={c.onAccent} />
        </Animated.View>
        <Animated.View style={{position: 'absolute', opacity: tick, transform: [{scale: tick.interpolate({inputRange: [0, 1], outputRange: [0.4, 1]})}]}}>
          <Ionicons name="checkmark" size={30} color={c.onAccent} />
        </Animated.View>
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={withAlpha(c.onAccent, 0.55)}
        selectionColor={c.onAccent}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        autoFocus={autoFocus}
        onFocus={onFocus}
        onBlur={onBlur}
        textContentType={textContentType}
        onSubmitEditing={onSubmitEditing}
        returnKeyType={returnKeyType}
        maxLength={maxLength}
        accessibilityLabel={placeholder}
        style={{flex: 1, height: 44, color: c.onAccent, fontFamily: theme.font.extrabold, fontSize: 24}}
      />
      {note ? (
        <AppText size={14} weight="extrabold" color={withAlpha(c.onAccent, 0.9)}>
          {note}
        </AppText>
      ) : null}
    </View>
  );
}

/**
 * LineField that only takes an option from a list (make, model): typing shows matching options in a
 * white card under the line; leaving the field with anything else puts the last pick back.
 */
export function LinePicker({
  value,
  options,
  onChange,
  placeholder,
  disabled,
  autoFocus,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const c = useAppTheme().colors;
  const [query, setQuery] = useState(value);
  const [focused, setFocused] = useState(false);
  const exact = options.find((o) => o.toLowerCase() === query.trim().toLowerCase());
  const matches = focused && !(exact && exact === value) ? matchOptions(options, query, 6) : [];
  const pick = (option: string) => {
    setQuery(option);
    onChange(option);
    void Haptics.selectionAsync().catch(() => undefined);
  };
  return (
    <View style={{opacity: disabled ? 0.45 : 1}} pointerEvents={disabled ? 'none' : 'auto'}>
      <LineField
        value={query}
        onChangeText={setQuery}
        placeholder={placeholder}
        valid={!!value && query === value}
        autoCapitalize="words"
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          // Typing the full name counts as picking it; anything else is not an option.
          if (exact) {
            pick(exact);
          } else {
            setQuery(value);
          }
        }}
      />
      {matches.length > 0 ? (
        <View style={{backgroundColor: c.onAccent, borderRadius: 22, marginTop: 8, paddingVertical: 4, overflow: 'hidden'}}>
          {matches.map((option, i) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityLabel={option}
              onPress={() => pick(option)}
              style={({pressed}) => ({
                paddingHorizontal: 18,
                height: 48,
                justifyContent: 'center',
                borderTopWidth: i ? 1 : 0,
                borderTopColor: withAlpha(c.accentDeep, 0.12),
                backgroundColor: pressed ? withAlpha(c.accent, 0.1) : undefined,
              })}>
              <AppText size={17} weight="extrabold" color={c.accentDeep} numberOfLines={1}>
                {option}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
