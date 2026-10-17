import {Ionicons} from '@expo/vector-icons';
import {Pressable, View} from 'react-native';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';

type IconName = keyof typeof Ionicons.glyphMap;

interface ReliabilityTileProps {
  icon: IconName;
  color: string;
  title: string;
  hint: string;
  /** Live check: true shows a green check, false shows "Fix" (onFix), undefined is a plain tip. */
  ok?: boolean;
  onFix?: () => void;
}

/** One of Rovy's four "recording reliability" tips, with a live check where the app can read it. */
export function ReliabilityTile({icon, color, title, hint, ok, onFix}: ReliabilityTileProps) {
  const c = useAppTheme().colors;
  return (
    <View style={{flex: 1, minHeight: 128, borderRadius: 22, backgroundColor: c.canvas, padding: 14, alignItems: 'center', gap: 6}}>
      <Ionicons name={icon} size={24} color={color} />
      <AppText size={14} weight="black" style={{textAlign: 'center'}}>
        {title}
      </AppText>
      <AppText size={12} weight="semibold" tone="secondary" style={{textAlign: 'center'}}>
        {hint}
      </AppText>
      {ok === true ? (
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 'auto'}}>
          <Ionicons name="checkmark-circle" size={15} color={c.green} />
          <AppText size={12} weight="extrabold" color={c.green}>
            On
          </AppText>
        </View>
      ) : ok === false && onFix ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Fix ${title}`} onPress={onFix} style={{marginTop: 'auto', backgroundColor: c.accent, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 5}}>
          <AppText size={12} weight="black" tone="onAccent">
            Fix
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
