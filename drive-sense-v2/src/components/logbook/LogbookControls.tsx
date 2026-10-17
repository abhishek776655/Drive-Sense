import {Ionicons} from '@expo/vector-icons';
import {useEffect, useState} from 'react';
import {Pressable, TextInput, View} from 'react-native';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {Glass} from '../Glass';
import {GlassButton} from '../GlassButton';
import {MapButton} from '../trip/MapButton';

const DEBOUNCE_MS = 300;

interface LogbookControlsProps {
  search: string;
  sortLabel: string;
  periodLabel: string;
  filterActive: boolean;
  selecting: boolean;
  onSearch: (text: string) => void;
  onOpenSort: () => void;
  onOpenPeriod: () => void;
  onOpenFilter: () => void;
  onToggleSelect: () => void;
}

function Chip({icon, label, onPress}: {icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void}) {
  const c = useAppTheme().colors;
  return (
    <GlassButton accessibilityLabel={`${label}, change`} onPress={onPress} style={{flexDirection: 'row', gap: 5, height: 34, paddingHorizontal: 12}}>
      <Ionicons name={icon} size={14} color={c.accent} />
      <AppText size={13} weight="extrabold">
        {label}
      </AppText>
      <Ionicons name="chevron-down" size={13} color={c.textSecondary} />
    </GlassButton>
  );
}

/** Odo-style search and the sort / period chips, with Filter and Select at the end of the row. */
export function LogbookControls(props: LogbookControlsProps) {
  const {search, sortLabel, periodLabel, filterActive, selecting, onSearch, onOpenSort, onOpenPeriod, onOpenFilter, onToggleSelect} = props;
  const theme = useAppTheme();
  const c = theme.colors;
  // Local text so typing is instant; the parent remounts this (key) to clear it from outside.
  const [text, setText] = useState(search);

  // Search as the user types, once they pause.
  useEffect(() => {
    if (text === search) {
      return;
    }
    const timer = setTimeout(() => onSearch(text), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, search, onSearch]);

  return (
    <View style={{gap: 10}}>
      <Glass radius={18} style={{flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 14}}>
        <Ionicons name="search" size={18} color={c.textSecondary} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Search place or vehicle…"
          placeholderTextColor={c.textTertiary}
          returnKeyType="search"
          autoCorrect={false}
          onSubmitEditing={() => onSearch(text)}
          style={{flex: 1, fontSize: 16, fontFamily: theme.font.bold, color: c.textPrimary}}
        />
        {text ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={8}
            onPress={() => {
              setText('');
              onSearch('');
            }}>
            <Ionicons name="close-circle" size={18} color={c.textTertiary} />
          </Pressable>
        ) : null}
      </Glass>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
        <Chip icon="swap-vertical" label={sortLabel} onPress={onOpenSort} />
        <Chip icon="time-outline" label={periodLabel} onPress={onOpenPeriod} />
        <View style={{flex: 1}} />
        <View>
          <MapButton icon="options-outline" label={filterActive ? 'Filters, on' : 'Filters'} onPress={onOpenFilter} size={34} />
          {filterActive ? <View pointerEvents="none" style={{position: 'absolute', top: 1, right: 1, width: 9, height: 9, borderRadius: 5, backgroundColor: c.accent}} /> : null}
        </View>
        {selecting ? (
          <GlassButton accessibilityLabel="Cancel selecting" onPress={onToggleSelect} style={{height: 34, paddingHorizontal: 12}}>
            <AppText size={13} weight="extrabold" tone="accent">
              Cancel
            </AppText>
          </GlassButton>
        ) : (
          <MapButton icon="checkmark-circle-outline" label="Select drives" onPress={onToggleSelect} size={34} />
        )}
      </View>
    </View>
  );
}
