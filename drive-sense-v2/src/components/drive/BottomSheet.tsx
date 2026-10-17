import type {ReactNode} from 'react';
import {Modal, Pressable, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {Glass} from '../Glass';

const SHEET_RADIUS = 34;
const SHEET_INSET = 8;

/**
 * Slide-up glass sheet with a title and a Done action. Floats inset from the screen edges with
 * rounded corners all round, like iOS 26 sheets; Liquid Glass on iOS 26, blur elsewhere.
 */
export function BottomSheet({visible, title, onClose, children}: {visible: boolean; title: string; onClose: () => void; children: ReactNode}) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{flex: 1, justifyContent: 'flex-end'}}>
        <Pressable accessibilityLabel="Close" style={[StyleSheet.absoluteFill, {backgroundColor: theme.colors.scrim}]} onPress={onClose} />
        <Glass
          radius={SHEET_RADIUS}
          style={{
            marginHorizontal: SHEET_INSET,
            marginBottom: Math.max(insets.bottom, SHEET_INSET),
            maxHeight: '85%',
          }}>
          <View style={{flexShrink: 1, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 16}}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
              <AppText size={20} weight="black">
                {title}
              </AppText>
              <Pressable accessibilityRole="button" accessibilityLabel="Done" onPress={onClose} hitSlop={10}>
                <AppText size={15} weight="extrabold" tone="accent">
                  Done
                </AppText>
              </Pressable>
            </View>
            {children}
          </View>
        </Glass>
      </View>
    </Modal>
  );
}
