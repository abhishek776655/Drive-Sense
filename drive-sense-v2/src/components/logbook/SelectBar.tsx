import {ActivityIndicator, Pressable, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {withAlpha} from '../../theme/color';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {Glass} from '../Glass';
import {GlassButton} from '../GlassButton';
import {TAB_BAR_GAP, TAB_BAR_HEIGHT, tabBarBottom} from '../tabBarLayout';

/** Space the list leaves at the bottom while selecting, so the last row clears the bar. */
export const SELECT_BAR_SPACE = 76;

/** Floating bar while selecting drives: Select all, and Delete N drives. Sits just above the tab bar. */
export function SelectBar({count, onSelectAll, onDelete, deleting}: {count: number; onSelectAll: () => void; onDelete: () => void; deleting: boolean}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{position: 'absolute', left: theme.space.screen, right: theme.space.screen, bottom: tabBarBottom(insets.bottom) + TAB_BAR_HEIGHT + TAB_BAR_GAP}}>
      <Glass radius={30} style={{flexDirection: 'row', alignItems: 'center', padding: 6, gap: 8}}>
        <Pressable accessibilityRole="button" onPress={onSelectAll} hitSlop={6} style={{paddingHorizontal: 14, paddingVertical: 12}}>
          <AppText size={15} weight="extrabold" tone="accent">
            Select all
          </AppText>
        </Pressable>
        <View style={{flex: 1}}>
          <GlassButton
            accessibilityLabel={`Delete ${count} drives`}
            onPress={onDelete}
            disabled={count === 0 || deleting}
            tint={withAlpha(c.red, 0.78)}
            style={{height: 48, flexDirection: 'row', gap: 8}}>
            {deleting ? (
              <ActivityIndicator color={c.onAccent} />
            ) : (
              <AppText size={16} weight="black" tone="onAccent">
                {count === 0 ? 'Select drives' : `Delete ${count} ${count === 1 ? 'drive' : 'drives'}`}
              </AppText>
            )}
          </GlassButton>
        </View>
      </Glass>
    </View>
  );
}
