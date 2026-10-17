import {StyleSheet, View} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {useAppTheme} from '../../theme/ThemeProvider';
import type {BumpLayout} from '../../utils/bumpPath';

/** Web: CSS clip-path + backdrop-filter give the same single-piece glass as the native mask. */
export function BumpGlass({layout, width, height}: {layout: BumpLayout; width: number; height: number}) {
  const theme = useAppTheme();
  const {path} = layout;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          clipPath: `path('${path}')`,
          backdropFilter: 'blur(22px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(22px) saturate(1.5)',
          backgroundColor: theme.colors.glassFill,
        }}
      />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Path d={path} fill="none" stroke={theme.colors.glassBorder} strokeWidth={1} />
      </Svg>
    </View>
  );
}
