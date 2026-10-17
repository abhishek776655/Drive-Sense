import type {ReactNode} from 'react';
import {View, type StyleProp, type ViewStyle} from 'react-native';
import {softShadow} from '../theme/shadow';
import {useAppTheme} from '../theme/ThemeProvider';

/** Tile surface with a very soft shadow in both appearances. */
export function Card({children, style}: {children?: ReactNode; style?: StyleProp<ViewStyle>}) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.card,
          borderRadius: theme.radius.card,
          ...softShadow(theme.colors),
        },
        style,
      ]}>
      {children}
    </View>
  );
}
