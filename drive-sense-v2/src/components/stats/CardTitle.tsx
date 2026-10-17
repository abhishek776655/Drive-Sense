import type {ReactNode} from 'react';
import {View} from 'react-native';
import {AppText} from '../AppText';

/** Title (and optional subtitle) at the top of a stats card, with room for a control on the right. */
export function CardTitle({title, subtitle, right}: {title: string; subtitle?: string; right?: ReactNode}) {
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
      <View style={{flex: 1}}>
        <AppText size={16} weight="black">
          {title}
        </AppText>
        {subtitle ? (
          <AppText size={12} weight="semibold" tone="secondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </View>
  );
}
