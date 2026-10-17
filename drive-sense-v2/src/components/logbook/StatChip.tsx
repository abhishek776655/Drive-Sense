import {Ionicons} from '@expo/vector-icons';
import {View} from 'react-native';
import {withAlpha} from '../../theme/color';
import {AppText} from '../AppText';

/** Rovy's tinted stat pill: icon and value on a wash of the same colour. */
export function StatChip({icon, color, label}: {icon: keyof typeof Ionicons.glyphMap; color: string; label: string}) {
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 99, backgroundColor: withAlpha(color, 0.12)}}>
      <Ionicons name={icon} size={11} color={color} />
      <AppText size={12} weight="bold" numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}
