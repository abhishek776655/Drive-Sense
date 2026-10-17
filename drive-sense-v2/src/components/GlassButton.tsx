import type {ReactNode} from 'react';
import {Pressable, type AccessibilityRole, type AccessibilityState, type StyleProp, type ViewStyle} from 'react-native';
import {hasLiquidGlass} from '../theme/liquidGlass';
import {Glass} from './Glass';

interface GlassButtonProps {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  disabled?: boolean;
  /** Coloured glass for primary / destructive actions. */
  tint?: string;
  /** Solid edge-to-edge fill, for a toggle that is on. */
  fill?: string;
  radius?: number;
  /** Size and layout of the glass (height, width or flex, padding, alignment). */
  style?: StyleProp<ViewStyle>;
}

/**
 * A button made of glass: Liquid Glass on iOS 26 (it shimmers under the finger), blur elsewhere.
 * Used for controls floating over content, such as map buttons and the trip page's actions.
 */
export function GlassButton({children, onPress, accessibilityLabel, accessibilityRole = 'button', accessibilityState, disabled, tint, fill, radius = 999, style}: GlassButtonProps) {
  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{disabled, ...accessibilityState}}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      // Liquid Glass answers touches itself; the fallback dims instead.
      style={({pressed}) => ({opacity: disabled ? 0.5 : pressed && !hasLiquidGlass() ? 0.75 : 1})}>
      <Glass interactive tint={tint} fill={fill} radius={radius} style={[{alignItems: 'center', justifyContent: 'center'}, style]}>
        {children}
      </Glass>
    </Pressable>
  );
}
