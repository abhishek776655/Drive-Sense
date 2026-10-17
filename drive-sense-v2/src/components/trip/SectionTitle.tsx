import {Ionicons} from '@expo/vector-icons';
import type {ReactNode} from 'react';
import {View} from 'react-native';
import {AppText} from '../AppText';

type IconName = keyof typeof Ionicons.glyphMap;

/** Section heading on the trip page: tinted icon, title, optional right-hand slot. */
export function SectionTitle({icon, color, title, right}: {icon: IconName; color: string; title: string; right?: ReactNode}) {
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, marginHorizontal: 4}}>
      <Ionicons name={icon} size={18} color={color} />
      <AppText size={17} weight="black" style={{flex: 1}}>
        {title}
      </AppText>
      {right}
    </View>
  );
}
