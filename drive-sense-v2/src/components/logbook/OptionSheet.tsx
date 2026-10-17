import {Ionicons} from '@expo/vector-icons';
import {Pressable, View} from 'react-native';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {BottomSheet} from '../drive/BottomSheet';

interface OptionSheetProps<T extends string> {
  visible: boolean;
  title: string;
  options: {value: T; label: string}[];
  value: T;
  onPick: (value: T) => void;
  onClose: () => void;
}

/** A short list of choices (sort, period) with a check on the current one; picking closes it. */
export function OptionSheet<T extends string>({visible, title, options, value, onPick, onClose}: OptionSheetProps<T>) {
  const c = useAppTheme().colors;
  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
      <View style={{gap: 6, marginTop: 8, marginBottom: 8}}>
        {options.map((option) => {
          const on = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{selected: on}}
              onPress={() => {
                onPick(option.value);
                onClose();
              }}
              style={{flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, backgroundColor: c.glassRow}}>
              <AppText size={15} weight="extrabold" style={{flex: 1}}>
                {option.label}
              </AppText>
              {on ? <Ionicons name="checkmark-circle" size={22} color={c.accent} /> : null}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}
