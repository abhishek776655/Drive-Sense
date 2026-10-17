import {View} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {useAppTheme} from '../../theme/ThemeProvider';

/**
 * The car on the map: an arrow pointing the way you are heading once the heading is known, a dot
 * before that. `rotation` is relative to the screen (heading minus the camera's heading).
 */
export function PositionArrow({rotation}: {rotation: number | null}) {
  const theme = useAppTheme();
  if (rotation == null) {
    return <View style={{width: 20, height: 20, borderRadius: 10, backgroundColor: theme.colors.accent, borderWidth: 3, borderColor: theme.colors.onAccent}} />;
  }
  return (
    <View style={{width: 34, height: 34, alignItems: 'center', justifyContent: 'center', transform: [{rotate: `${rotation}deg`}]}}>
      <Svg width={30} height={30} viewBox="0 0 24 24">
        <Path d="M12 2.5 20 20.5 12 16.6 4 20.5Z" fill={theme.colors.accent} stroke={theme.colors.onAccent} strokeWidth={2} strokeLinejoin="round" />
      </Svg>
    </View>
  );
}
