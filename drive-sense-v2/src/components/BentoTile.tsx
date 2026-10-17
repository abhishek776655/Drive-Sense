import {Ionicons} from '@expo/vector-icons';
import type {ReactNode} from 'react';
import {View, type StyleProp, type ViewStyle} from 'react-native';
import {AppText} from './AppText';
import {Card} from './Card';

type IconName = keyof typeof Ionicons.glyphMap;

interface BentoTileProps {
  label: string;
  value: string;
  unit?: string;
  icon?: IconName;
  iconColor?: string;
  /** Rendered after the value (e.g. a score delta). */
  accessory?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Smaller type and icon, for denser screens (My Profile). */
  compact?: boolean;
}

/** Label over value, icon centred at the right edge. Min-height 66, content vertically centred. */
export function BentoTile({label, value, unit, icon, iconColor, accessory, style, compact}: BentoTileProps) {
  return (
    <Card style={[{flex: 1, minHeight: 66, paddingVertical: 14, paddingHorizontal: 16, justifyContent: 'center'}, style]}>
      <View style={{flexDirection: 'row', alignItems: 'center'}}>
        <View style={{flex: 1}}>
          <AppText size={compact ? 12 : 13} weight="bold" tone="secondary">
            {label}
          </AppText>
          <View style={{flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2}}>
            <AppText size={compact ? 18 : 22} weight="black">
              {value}
            </AppText>
            {unit ? (
              <AppText size={compact ? 11 : 12} weight="semibold" tone="secondary">
                {unit}
              </AppText>
            ) : null}
            {accessory}
          </View>
        </View>
        {icon ? <Ionicons name={icon} size={compact ? 20 : 24} color={iconColor} /> : null}
      </View>
    </Card>
  );
}
