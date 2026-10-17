import {isGlassEffectAPIAvailable, isLiquidGlassAvailable} from 'expo-glass-effect';
import {Platform} from 'react-native';

let cached: boolean | null = null;

/**
 * True when native iOS 26 Liquid Glass can render. Some iOS 26 betas lack the runtime API and crash,
 * so both checks must pass; everything else (Android, web, older iOS) uses the blur fallback.
 */
export const hasLiquidGlass = (): boolean => {
  if (cached == null) {
    try {
      cached = Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
    } catch {
      cached = false;
    }
  }
  return cached;
};
