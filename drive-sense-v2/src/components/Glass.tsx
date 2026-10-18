import {BlurView} from 'expo-blur';
import {GlassView} from 'expo-glass-effect';
import type {ReactNode} from 'react';
import {Platform, StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import {hasLiquidGlass} from '../theme/liquidGlass';
import {softShadow} from '../theme/shadow';
import {useAppTheme} from '../theme/ThemeProvider';

interface GlassProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  /** iOS 26: the glass reacts to touch (shimmer and lift), as system tab bars do. */
  interactive?: boolean;
  /** Coloured glass (e.g. the accent for a primary action). Fallback: the colour as a translucent fill. */
  tint?: string;
  /**
   * Solid fill over the glass, edge to edge (a selected toggle). The glass tint is inset from the
   * edge on iOS 26 and the rim is drawn over it, which left a clear ring; a fill has neither.
   */
  fill?: string;
  /** A soft lift under the glass (default on); off where it would read as a stray outline. */
  shadow?: boolean;
  /** Force light or dark glass (e.g. on the always-dark weather card); defaults to the app's. */
  scheme?: 'light' | 'dark';
  /** See-through glass that lets the map show through (iOS 26 "clear"); the fallback blurs less. */
  clear?: boolean;
}

/** Styles that place and size the element: they go on the outer (shadow) layer. */
const OUTER_KEYS = new Set([
  'position', 'top', 'left', 'right', 'bottom', 'zIndex',
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
  'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical',
  'transform', 'opacity',
]);

const splitStyle = (style: StyleProp<ViewStyle>) => {
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    (OUTER_KEYS.has(key) ? outer : inner)[key] = value;
  }
  return {outer: outer as ViewStyle, inner: inner as ViewStyle};
};

/**
 * Glass surface for the tab bar, map chips and banners. iOS 26 gets native Liquid Glass; other
 * platforms get a blur with a light translucent fill and a 1px edge.
 */
export function Glass({children, style, radius = 999, interactive = false, tint, fill, shadow = true, scheme, clear = false}: GlassProps) {
  const fillLayer = fill ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, {backgroundColor: fill, borderRadius: radius}]} /> : null;
  const theme = useAppTheme();
  if (shadow) {
    // The glass clips its corners, which would clip a shadow too: the shadow lives on a wrapper
    // that takes the placement styles, and the glass fills it.
    const {outer, inner} = splitStyle(style);
    // The glass fills the wrapper only when the caller sized it (height, flex…). A chip sized by its
    // text must not grow, or it stretches down the screen (the Drive map's heading and ELEV chips).
    const sized = outer.height != null || outer.flex != null || outer.flexGrow != null || outer.minHeight != null;
    return (
      <View style={[{borderRadius: radius}, softShadow(theme.colors, 'small'), outer]}>
        <Glass radius={radius} interactive={interactive} tint={tint} fill={fill} shadow={false} scheme={scheme} clear={clear} style={[{borderRadius: radius}, sized ? {flexGrow: 1} : null, inner]}>
          {children}
        </Glass>
      </View>
    );
  }
  if (hasLiquidGlass()) {
    return (
      <GlassView glassEffectStyle={clear ? 'clear' : 'regular'} isInteractive={interactive} tintColor={tint} colorScheme={scheme ?? theme.scheme} style={[{borderRadius: radius, overflow: 'hidden'}, style]}>
        {fillLayer}
        {children}
        {/* No drawn rim: Liquid Glass lights its own edge, and a second one reads as a border. */}
      </GlassView>
    );
  }
  return (
    <View style={[{borderRadius: radius, overflow: 'hidden'}, style]}>
      <GlassBlur />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: tint ?? (clear ? 'transparent' : theme.colors.glassFill),
            borderRadius: radius,
          },
        ]}
      />
      {fillLayer}
      {children}
      {fill ? null : <GlassRim radius={radius} />}
    </View>
  );
}

/** Fallback blur layer, filling its parent. Never placed under a mask: iOS blur stops rendering there. */
export function GlassBlur() {
  const theme = useAppTheme();
  return (
    <BlurView
      intensity={50}
      tint={theme.scheme === 'dark' ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'}
      blurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
      style={StyleSheet.absoluteFill}
    />
  );
}

/**
 * The thick-glass edge: a bright rim along the top where light catches it, fading to a dim one at the
 * bottom, plus a faint inner line one point in. Drawn over the content so it frames everything.
 */
export function GlassRim({radius}: {radius: number}) {
  const theme = useAppTheme();
  const c = theme.colors;
  return (
    <>
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            borderWidth: 1.2,
            borderTopColor: c.glassRimLight,
            borderLeftColor: c.glassBorder,
            borderRightColor: c.glassBorder,
            borderBottomColor: c.glassRimDark,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 1.5,
          left: 1.5,
          right: 1.5,
          bottom: 1.5,
          borderRadius: Math.max(0, radius - 1.5),
          borderWidth: StyleSheet.hairlineWidth,
          borderTopColor: c.glassBorder,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: 'transparent',
        }}
      />
    </>
  );
}

