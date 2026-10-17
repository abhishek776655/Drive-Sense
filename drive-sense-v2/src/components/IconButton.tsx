import {Ionicons} from '@expo/vector-icons';
import {useAppTheme} from '../theme/ThemeProvider';
import {GlassButton} from './GlassButton';

type IconName = keyof typeof Ionicons.glyphMap;

/** Round header control (gear, back): Liquid Glass on iOS 26, as the map buttons are. */
export function IconButton({icon, onPress, label, size = 52}: {icon: IconName; onPress: () => void; label: string; size?: number}) {
  const theme = useAppTheme();
  return (
    <GlassButton accessibilityLabel={label} onPress={onPress} radius={size / 2} style={{width: size, height: size}}>
      <Ionicons name={icon} size={size * 0.46} color={theme.colors.accent} />
    </GlassButton>
  );
}
