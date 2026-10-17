import {GlassContainer, GlassView} from 'expo-glass-effect';
import {StyleSheet, View} from 'react-native';
import Svg, {Defs, LinearGradient, Path, Stop} from 'react-native-svg';
import {splitAlpha} from '../../theme/color';
import {hasLiquidGlass} from '../../theme/liquidGlass';
import {useAppTheme} from '../../theme/ThemeProvider';
import {DEFAULT_BUMP, type BumpLayout} from '../../utils/bumpPath';
import {GlassBlur} from '../Glass';

interface BumpGlassProps {
  layout: BumpLayout;
  width: number;
  height: number;
}

/**
 * The Drive sheet's glass: a rounded sheet plus a circle rising above its top edge.
 *
 * iOS 26: two Liquid Glass views in one GlassContainer, which fuses them into a single shape with
 * smooth shoulders, as in Rovy. Elsewhere: the same two pieces as plain blur, clipped by rounded
 * corners only (a mask would stop iOS blur rendering), with the bump outline drawn on top.
 */
export function BumpGlass({layout, width, height}: BumpGlassProps) {
  const theme = useAppTheme();
  const {radius, corner} = DEFAULT_BUMP;
  const circle = {
    position: 'absolute' as const,
    left: layout.center.x - radius,
    top: layout.center.y - radius,
    width: radius * 2,
    height: radius * 2,
    borderRadius: radius,
  };
  const body = {position: 'absolute' as const, left: 0, right: 0, top: layout.bodyTop, bottom: 0, borderRadius: corner};

  if (hasLiquidGlass()) {
    // `regular` frosts a pale light-mode map almost white, so Light uses the see-through `clear`.
    const glassStyle = theme.scheme === 'light' ? 'clear' : 'regular';
    return (
      <GlassContainer spacing={22} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <GlassView glassEffectStyle={glassStyle} colorScheme={theme.scheme} style={circle} />
        <GlassView glassEffectStyle={glassStyle} colorScheme={theme.scheme} style={body} />
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="bumpRim" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={height}>
              <Stop offset="0" stopColor={splitAlpha(theme.colors.glassRimLight).color} stopOpacity={splitAlpha(theme.colors.glassRimLight).opacity} />
              <Stop offset="0.45" stopColor={splitAlpha(theme.colors.glassBorder).color} stopOpacity={splitAlpha(theme.colors.glassBorder).opacity} />
              <Stop offset="1" stopColor={splitAlpha(theme.colors.glassRimDark).color} stopOpacity={splitAlpha(theme.colors.glassRimDark).opacity} />
            </LinearGradient>
          </Defs>
          <Path d={layout.path} fill="none" stroke="url(#bumpRim)" strokeWidth={1.4} />
        </Svg>
      </GlassContainer>
    );
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Only the part of the circle above the sheet, so the overlap is not blurred twice. */}
      <View style={{position: 'absolute', left: 0, right: 0, top: 0, height: layout.bodyTop, overflow: 'hidden'}}>
        <View style={[circle, {overflow: 'hidden'}]}>
          <GlassBlur />
        </View>
      </View>
      <View style={[body, {overflow: 'hidden'}]}>
        <GlassBlur />
      </View>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="bumpRimFallback" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={height}>
            <Stop offset="0" stopColor={splitAlpha(theme.colors.glassRimLight).color} stopOpacity={splitAlpha(theme.colors.glassRimLight).opacity} />
            <Stop offset="0.45" stopColor={splitAlpha(theme.colors.glassBorder).color} stopOpacity={splitAlpha(theme.colors.glassBorder).opacity} />
            <Stop offset="1" stopColor={splitAlpha(theme.colors.glassRimDark).color} stopOpacity={splitAlpha(theme.colors.glassRimDark).opacity} />
          </LinearGradient>
        </Defs>
        <Path d={layout.path} fill={theme.colors.glassFill} stroke="url(#bumpRimFallback)" strokeWidth={1.4} />
      </Svg>
    </View>
  );
}
