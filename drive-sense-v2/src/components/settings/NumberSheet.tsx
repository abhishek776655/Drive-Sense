import {useState} from 'react';
import {Modal, Pressable, TextInput, View} from 'react-native';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {GlassButton} from '../GlassButton';

/** "105,5" and "105.5" both read as 105.5; anything else is not a number. */
export const parseAmount = (text: string): number | null => {
  const cleaned = text.trim().replace(',', '.');
  if (!/^\d*\.?\d+$/.test(cleaned) && !/^\d+\.$/.test(cleaned)) {
    return null;
  }
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
};

/**
 * One number in a sheet (fuel price, tank size): a big field with its unit, Save, and Clear to unset.
 * `valid` decides what Save accepts.
 */
export function NumberSheet({
  title,
  hint,
  prefix,
  unit,
  initial,
  valid,
  onSave,
  onClose,
}: {
  title: string;
  hint: string;
  prefix?: string;
  unit: string;
  initial: number | null;
  valid: (value: number) => boolean;
  onSave: (value: number | null) => void;
  onClose: () => void;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const [text, setText] = useState(initial != null ? String(Math.round(initial * 100) / 100) : '');
  const value = parseAmount(text);
  const ok = value != null && valid(value);
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{flex: 1, backgroundColor: c.canvas}}>
        <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12}}>
          <GlassButton accessibilityLabel="Cancel" onPress={onClose} style={{height: 44, paddingHorizontal: 18}}>
            <AppText size={17} weight="bold" tone="accent">
              Cancel
            </AppText>
          </GlassButton>
          <AppText size={17} weight="extrabold">
            {title}
          </AppText>
          <GlassButton accessibilityLabel="Save" onPress={() => ok && onSave(value)} disabled={!ok} style={{height: 44, paddingHorizontal: 18}}>
            <AppText size={17} weight="extrabold" tone="accent">
              Save
            </AppText>
          </GlassButton>
        </View>
        <View style={{padding: 24, gap: 14}}>
          <View style={{flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6}}>
            {prefix ? (
              <AppText size={34} weight="black" tone="secondary">
                {prefix}
              </AppText>
            ) : null}
            <TextInput
              value={text}
              onChangeText={setText}
              keyboardType="decimal-pad"
              autoFocus
              placeholder="0"
              placeholderTextColor={c.textTertiary}
              selectionColor={c.accent}
              accessibilityLabel={title}
              onSubmitEditing={() => ok && onSave(value)}
              // A single-line field doesn't grow with its text; sized here so no digit scrolls out of view.
              style={{width: Math.max(70, text.length * 30 + 12), fontFamily: theme.font.black, fontSize: 48, color: c.textPrimary, textAlign: 'center'}}
            />
            <AppText size={20} weight="extrabold" tone="secondary">
              {unit}
            </AppText>
          </View>
          <AppText size={14} weight="semibold" tone="secondary" style={{textAlign: 'center'}}>
            {hint}
          </AppText>
          {initial != null ? (
            <Pressable accessibilityRole="button" onPress={() => onSave(null)} style={({pressed}) => ({alignSelf: 'center', padding: 10, opacity: pressed ? 0.6 : 1})}>
              <AppText size={15} weight="extrabold" color={c.red}>
                Clear
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
