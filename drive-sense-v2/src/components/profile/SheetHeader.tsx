import type {ReactNode} from 'react';
import {View} from 'react-native';
import {AppText} from '../AppText';

/** Rovy's sheet header: glass button left, centred title, glass button right. */
export function SheetHeader({title, left, right}: {title: string; left: ReactNode; right: ReactNode}) {
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12}}>
      <View style={{minWidth: 90, alignItems: 'flex-start'}}>{left}</View>
      <AppText size={17} weight="extrabold">
        {title}
      </AppText>
      <View style={{minWidth: 90, alignItems: 'flex-end'}}>{right}</View>
    </View>
  );
}
