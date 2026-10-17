import {Ionicons} from '@expo/vector-icons';
import {useAppTheme} from '../../theme/ThemeProvider';
import {GlassButton} from '../GlassButton';

type IconName = keyof typeof Ionicons.glyphMap;

/** Round glass button floating over a map or content. */
export function MapButton({icon, label, onPress, size = 40, color, tint, disabled}: {icon: IconName; label: string; onPress: () => void; size?: number; color?: string; tint?: string; disabled?: boolean}) {
  const theme = useAppTheme();
  return (
    <GlassButton accessibilityLabel={label} onPress={onPress} tint={tint} disabled={disabled} style={{width: size, height: size}}>
      <Ionicons name={icon} size={size * 0.45} color={color ?? theme.colors.textPrimary} />
    </GlassButton>
  );
}
