import {Ionicons} from '@expo/vector-icons';
import {ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle} from 'react-native';
import {withAlpha} from '../theme/color';
import {hasLiquidGlass} from '../theme/liquidGlass';
import {useAppTheme} from '../theme/ThemeProvider';
import {AppText} from './AppText';
import {GlassButton} from './GlassButton';

type IconName = keyof typeof Ionicons.glyphMap;

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  icon?: IconName;
  /** `primary`: orange glass, white text. `soft`: light orange glass, orange text (Add photo, Show all time). */
  variant?: 'primary' | 'soft';
  busy?: boolean;
  disabled?: boolean;
  height?: number;
  size?: number;
  accessibilityLabel?: string;
  /** Off: a plain solid pill even on iOS 26 (e.g. Add photo, which sits on a card). */
  glass?: boolean;
  /** Placement and width (flex, alignSelf, margins, paddingHorizontal). */
  style?: StyleProp<ViewStyle>;
}

/**
 * The app's call-to-action button. On iOS 26 it is orange-tinted Liquid Glass (it shimmers under the
 * finger); elsewhere glass tint would read as washed-out, so it stays a solid orange pill.
 */
export function ActionButton({label, onPress, icon, variant = 'primary', busy, disabled, height = 50, size = 17, accessibilityLabel, glass = true, style}: ActionButtonProps) {
  const c = useAppTheme().colors;
  const primary = variant === 'primary';
  const fg = primary ? c.onAccent : c.accent;
  const content = busy ? (
    <ActivityIndicator color={fg} />
  ) : (
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
      {icon ? <Ionicons name={icon} size={size} color={fg} /> : null}
      <AppText size={size} weight={primary ? 'black' : 'extrabold'} color={fg}>
        {label}
      </AppText>
    </View>
  );
  const shape: ViewStyle = {height, borderRadius: height / 2, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center'};

  if (glass && hasLiquidGlass()) {
    return (
      <GlassButton
        accessibilityLabel={accessibilityLabel ?? label}
        onPress={onPress}
        disabled={disabled || busy}
        tint={primary ? c.accent : withAlpha(c.accent, 0.18)}
        radius={height / 2}
        style={[shape, style]}>
        {content}
      </GlassButton>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled || busy}
      onPress={onPress}
      style={({pressed}) => [shape, {backgroundColor: primary ? c.accent : c.accentTint, opacity: disabled ? 0.5 : pressed ? 0.8 : 1}, style]}>
      {content}
    </Pressable>
  );
}
