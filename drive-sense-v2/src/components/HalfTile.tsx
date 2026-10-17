import type {ReactNode} from 'react';
import {View} from 'react-native';
import {AppText} from './AppText';
import {Card} from './Card';

/** Fixed lines, so two tiles side by side put their label and value at exactly the same heights. */
const LABEL_LINE = 18;
const VALUE_LINE = 28;

/**
 * Home's half-width tile: label over a value on the left, a 40 pt graphic centred on the right. Both
 * tiles in a row share this layout (and the parent gives each the same width), so they sit level.
 */
export function HalfTile({label, value, unit, right}: {label: string; value: string; unit?: string; right: ReactNode}) {
  return (
    <Card style={{flex: 1, height: 76, paddingLeft: 16, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 10}}>
      <View style={{flex: 1}}>
        <AppText size={13} weight="bold" tone="secondary" numberOfLines={1} style={{lineHeight: LABEL_LINE}}>
          {label}
        </AppText>
        <AppText size={22} weight="black" numberOfLines={1} adjustsFontSizeToFit style={{lineHeight: VALUE_LINE, marginTop: 2}}>
          {value}
          {unit ? (
            <AppText size={12} weight="semibold" tone="secondary">
              {' '}
              {unit}
            </AppText>
          ) : null}
        </AppText>
      </View>
      {right}
    </Card>
  );
}
