import SegmentedControl from '@react-native-segmented-control/segmented-control';
import {Platform, Pressable, View} from 'react-native';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';

/** Width of each segment of the compact native control. */
const SEGMENT_WIDTH = 78;

/**
 * Small two-or-more option switch used inside cards. On iOS it is the native segmented control, so
 * on iOS 26 the selected segment is Liquid Glass; elsewhere an accent pill on a grey track.
 */
export function SegmentedToggle<T extends string>({options, value, onChange}: {options: {value: T; label: string}[]; value: T; onChange: (v: T) => void}) {
  const theme = useAppTheme();
  const c = theme.colors;
  if (Platform.OS === 'ios') {
    return (
      <SegmentedControl
        values={options.map((o) => o.label)}
        selectedIndex={Math.max(0, options.findIndex((o) => o.value === value))}
        onChange={(event) => onChange(options[event.nativeEvent.selectedSegmentIndex].value)}
        appearance={theme.scheme}
        fontStyle={{fontFamily: theme.font.bold, fontSize: 12, color: c.textPrimary}}
        activeFontStyle={{fontFamily: theme.font.extrabold, fontSize: 12, color: c.textPrimary}}
        style={{height: 30, width: options.length * SEGMENT_WIDTH}}
      />
    );
  }
  return (
    <View style={{flexDirection: 'row', backgroundColor: c.control, borderRadius: 16, padding: 3}}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{selected: on}}
            onPress={() => onChange(o.value)}
            style={{paddingHorizontal: 12, height: 28, borderRadius: 14, justifyContent: 'center', backgroundColor: on ? c.accent : undefined}}>
            <AppText size={12} weight="extrabold" color={on ? c.onAccent : c.textSecondary}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
