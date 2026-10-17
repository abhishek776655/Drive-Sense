import {Ionicons} from '@expo/vector-icons';
import {Button, Host, Menu, Text} from '@expo/ui/swift-ui';
import {contentShape, frame, opacity, shapes, tint} from '@expo/ui/swift-ui/modifiers';
import {useState} from 'react';
import {Platform, Pressable, View} from 'react-native';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';

interface SelectMenuProps<T extends string | number> {
  options: {value: T; label: string}[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  /** Larger, heavier value text (Rovy's "5 min ⌃⌄" under a row) rather than a row's trailing value. */
  accent?: boolean;
}

/**
 * A value with ⌃⌄ that opens a pull-down menu right where it is (iOS's native menu, as Rovy uses),
 * with a check on the current choice. Off iOS it opens a short list in place.
 *
 * On iOS the label is drawn by React Native and the native menu lies over it, invisible: iOS 26
 * paints a menu's own label in the system tint or primary text colour whatever it is styled with.
 */
export function SelectMenu<T extends string | number>({options, value, onChange, accessibilityLabel, accent}: SelectMenuProps<T>) {
  const c = useAppTheme().colors;
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState({width: 0, height: 0});
  const current = options.find((o) => o.value === value)?.label ?? '';
  // Always the app's primary colour; SwiftUI would otherwise paint the label system blue.
  const color = c.accent;

  const label = (
    <View
      onLayout={(e) => setSize({width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height})}
      style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
      <AppText size={accent ? 16 : 15} weight={accent ? 'extrabold' : 'bold'} color={color}>
        {current}
      </AppText>
      <Ionicons name="chevron-expand" size={16} color={color} />
    </View>
  );

  if (Platform.OS === 'ios') {
    return (
      // VoiceOver reads the native menu (it is the control); the drawn label is only looks.
      <View>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {label}
        </View>
        {size.width > 0 ? (
          <Host style={{position: 'absolute', left: 0, top: 0, width: size.width, height: size.height}} modifiers={[tint(color)]}>
            <Menu label={<Text modifiers={[frame({width: size.width, height: size.height}), contentShape(shapes.rectangle()), opacity(0.02)]}>{current}</Text>}>
              {options.map((option) => (
                <Button
                  key={String(option.value)}
                  label={option.label}
                  systemImage={option.value === value ? 'checkmark' : undefined}
                  onPress={() => onChange(option.value)}
                />
              ))}
            </Menu>
          </Host>
        ) : null}
      </View>
    );
  }

  return (
    <View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${accessibilityLabel}, ${current}`} onPress={() => setOpen((o) => !o)}>
        {label}
      </Pressable>
      {open ? (
        <View style={{marginTop: 6, borderRadius: 14, backgroundColor: c.canvas, paddingVertical: 4}}>
          {options.map((option) => (
            <Pressable
              key={String(option.value)}
              accessibilityRole="button"
              accessibilityState={{selected: option.value === value}}
              onPress={() => {
                onChange(option.value);
                setOpen(false);
              }}
              style={{flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 12}}>
              <AppText size={14} weight="bold" style={{flex: 1}}>
                {option.label}
              </AppText>
              {option.value === value ? <Ionicons name="checkmark" size={16} color={c.accent} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
