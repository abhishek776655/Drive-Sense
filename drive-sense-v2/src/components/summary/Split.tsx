import type {ReactNode} from 'react';
import {View} from 'react-native';
import {useAppTheme} from '../../theme/ThemeProvider';

/** Equal columns with hairline dividers between them; `dividerColor` tints them to the surface (e.g. on the peach hero). */
export function Split({children, dividerColor}: {children: ReactNode[]; dividerColor?: string}) {
  const theme = useAppTheme();
  return (
    <View style={{flexDirection: 'row', alignItems: 'center'}}>
      {children.map((child, i) => (
        <View key={i} style={{flex: 1, flexDirection: 'row', alignItems: 'center'}}>
          {i > 0 ? <View style={{width: 1, alignSelf: 'stretch', marginVertical: 6, backgroundColor: dividerColor ?? theme.colors.separator}} /> : null}
          <View style={{flex: 1, alignItems: 'center'}}>{child}</View>
        </View>
      ))}
    </View>
  );
}
