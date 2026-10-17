import {useState} from 'react';
import {Pressable, TextInput, View} from 'react-native';
import {useAppTheme} from '../../theme/ThemeProvider';
import {matchOptions} from '../../data/vehicleCatalog';
import {AppText} from '../AppText';

interface PickerFieldProps {
  /** The picked option, or '' when nothing is picked yet. */
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  accessibilityLabel: string;
}

const ROW = 53;

/**
 * Rovy's type-to-pick field: typing a letter opens matching options under the input, inside the
 * same card. Only an option can be committed; leaving the field with anything else puts the last
 * pick back.
 */
export function PickerField({value, options, onChange, placeholder, disabled, accessibilityLabel}: PickerFieldProps) {
  const theme = useAppTheme();
  const c = theme.colors;
  const [query, setQuery] = useState(value);
  const [focused, setFocused] = useState(false);
  const exact = options.find((o) => o.toLowerCase() === query.trim().toLowerCase());
  const matches = focused && !(exact && exact === value) ? matchOptions(options, query) : [];
  const open = matches.length > 0;

  const pick = (option: string) => {
    setQuery(option);
    onChange(option);
  };

  return (
    <View style={{backgroundColor: c.card, borderRadius: open ? 26 : 99, paddingHorizontal: 18, opacity: disabled ? 0.5 : 1}}>
      <TextInput
        value={query}
        editable={!disabled}
        onChangeText={setQuery}
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
        placeholder={placeholder}
        placeholderTextColor={c.textTertiary}
        selectionColor={c.accent}
        autoCorrect={false}
        autoCapitalize="words"
        accessibilityLabel={accessibilityLabel}
        style={{height: 52, color: c.textPrimary, fontFamily: theme.font.semibold, fontSize: 17}}
      />
      {matches.map((option) => (
        <Pressable
          key={option}
          accessibilityRole="button"
          accessibilityLabel={option}
          onPress={() => pick(option)}
          style={({pressed}) => ({height: ROW, justifyContent: 'center', borderTopWidth: 1, borderTopColor: c.separator, opacity: pressed ? 0.6 : 1})}>
          <AppText size={17} weight="semibold" tone="accent" numberOfLines={1}>
            {option}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}
