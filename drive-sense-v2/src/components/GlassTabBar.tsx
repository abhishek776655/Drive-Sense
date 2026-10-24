import type {BottomTabBarProps} from 'expo-router/js-tabs';
import {useEffect, useMemo, useState} from 'react';
import {Animated, PanResponder, Pressable, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useRecordingStore} from '../stores/recordingStore';
import {useAppTheme} from '../theme/ThemeProvider';
import {GlassView} from 'expo-glass-effect';
import {withAlpha} from '../theme/color';
import {hasLiquidGlass} from '../theme/liquidGlass';
import {Glass} from './Glass';
import {MiniRecordingBanner} from './MiniRecordingBanner';
import {TabIcon, type TabIconName} from './TabIcons';
import {TAB_BAR_GAP, TAB_BAR_HEIGHT, tabBarBottom} from './tabBarLayout';

const ICONS: Record<string, TabIconName> = {index: 'home', logbook: 'route', drive: 'road', garage: 'car', telemetry: 'gauge'};
const BAR_PADDING = 6;
const PILL_HEIGHT = 52;
/** How much wider the pill gets mid-slide: the liquid "stretch" of iOS 26 tab bars. */
const STRETCH = 0.28;
/** Held or dragged, the pill swells into a lens (iOS 26) and the icon under it is magnified. */
const LENS_GROW_X = 0.14;
const LENS_GROW_Y = 0.22;
const ICON_MAGNIFY = 0.3;

/**
 * Floating glass pill. The active-tab indicator is one pill that springs to the selected tab and
 * stretches while it travels, instead of each tab drawing its own background. It can also be
 * dragged: a horizontal drag along the bar moves the pill under the finger, and letting go snaps it
 * to the nearest tab and opens that tab. While held it swells into a magnifying lens, and the icon
 * under it grows with it. Plain taps still go to the tab pressed.
 */
export function GlassTabBar({state, descriptors, navigation}: BottomTabBarProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const recording = useRecordingStore((s) => s.status !== 'ready');
  const onDrive = state.routes[state.index]?.name === 'drive';
  const liquid = hasLiquidGlass();
  const [width, setWidth] = useState(0);
  const [position] = useState(() => new Animated.Value(state.index));
  const [stretch] = useState(() => new Animated.Value(0));
  // 1 while a finger holds the pill: the lens is up.
  const [held] = useState(() => new Animated.Value(0));
  // A live drive on the Drive tab gets the whole screen: the bar slides away until it ends.
  const hidden = onDrive && recording;
  const [hide] = useState(() => new Animated.Value(hidden ? 1 : 0));

  useEffect(() => {
    Animated.spring(hide, {toValue: hidden ? 1 : 0, useNativeDriver: true, damping: 18, stiffness: 160}).start();
  }, [hidden, hide]);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(position, {toValue: state.index, useNativeDriver: true, damping: 19, stiffness: 180, mass: 0.9}),
      Animated.sequence([
        Animated.timing(stretch, {toValue: 1, duration: 110, useNativeDriver: true}),
        Animated.spring(stretch, {toValue: 0, useNativeDriver: true, damping: 12, stiffness: 160}),
      ]),
    ]).start();
  }, [state.index, position, stretch]);

  const count = state.routes.length;
  const slot = width > 0 ? (width - BAR_PADDING * 2) / count : 0;
  const translateX = position.interpolate({
    inputRange: state.routes.map((_, i) => i),
    outputRange: state.routes.map((_, i) => BAR_PADDING + i * slot),
    // Spring overshoot past the first or last tab would push the pill out of the bar.
    extrapolate: 'clamp',
  });
  const scaleX = Animated.add(
    stretch.interpolate({inputRange: [0, 1], outputRange: [1, 1 + STRETCH]}),
    held.interpolate({inputRange: [0, 1], outputRange: [0, LENS_GROW_X]}),
  );
  const scaleY = held.interpolate({inputRange: [0, 1], outputRange: [1, 1 + LENS_GROW_Y]});

  const goTo = (index: number) => {
    const route = state.routes[index];
    const event = navigation.emit({type: 'tabPress', target: route.key, canPreventDefault: true});
    if (index !== state.index && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  const drag = useMemo(() => {
    // Gesture-local position, written by the callbacks below (not React state: no re-render per frame).
    const live = {value: state.index};
    const settle = () => {
      Animated.spring(stretch, {toValue: 0, useNativeDriver: true, damping: 12, stiffness: 160}).start();
      Animated.spring(held, {toValue: 0, useNativeDriver: true, damping: 14, stiffness: 200}).start();
    };
    return PanResponder.create({
      // Claim the gesture only for a clear horizontal drag, so taps reach the tab buttons.
      onMoveShouldSetPanResponderCapture: (_, g) => slot > 0 && Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => {
        position.stopAnimation();
        live.value = state.index;
        // Held pill stays slightly stretched and swells into a lens, like a lifted iOS 26 tab indicator.
        Animated.spring(stretch, {toValue: 0.55, useNativeDriver: true, damping: 14, stiffness: 220}).start();
        Animated.spring(held, {toValue: 1, useNativeDriver: true, damping: 12, stiffness: 240}).start();
      },
      onPanResponderMove: (_, g) => {
        live.value = Math.min(count - 1, Math.max(0, state.index + g.dx / slot));
        position.setValue(live.value);
      },
      onPanResponderRelease: () => {
        const target = Math.round(live.value);
        settle();
        if (target === state.index) {
          Animated.spring(position, {toValue: target, useNativeDriver: true, damping: 19, stiffness: 180}).start();
        } else {
          goTo(target);
        }
      },
      onPanResponderTerminate: () => {
        settle();
        Animated.spring(position, {toValue: state.index, useNativeDriver: true, damping: 19, stiffness: 180}).start();
      },
    });
    // goTo only reads state/navigation, which are already dependencies through state.index.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index, slot, count, position, stretch, held]);

  return (
    <Animated.View
      pointerEvents={hidden ? 'none' : 'auto'}
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: tabBarBottom(insets.bottom),
        gap: TAB_BAR_GAP,
        // Slide only: animating opacity on Liquid Glass stops it rendering.
        transform: [{translateY: hide.interpolate({inputRange: [0, 1], outputRange: [0, TAB_BAR_HEIGHT + tabBarBottom(insets.bottom) + 24]})}],
      }}>
      {recording && !onDrive ? <MiniRecordingBanner /> : null}
      <View style={{height: TAB_BAR_HEIGHT}}>
        <Glass interactive style={{height: TAB_BAR_HEIGHT}} />
        {/* Lens and icons sit above the bar's glass (not inside it), so the swollen lens is not clipped. */}
        <View style={{position: 'absolute', left: 0, right: 0, top: 0, bottom: 0}} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} {...drag.panHandlers}>
          {slot > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                top: (TAB_BAR_HEIGHT - PILL_HEIGHT) / 2,
                width: slot,
                height: PILL_HEIGHT,
                transform: [{translateX}, {scaleX}, {scaleY}],
              }}>
              {liquid ? (
                // A plain glass lens over the selected tab.
                <GlassView
                  glassEffectStyle="clear"
                  colorScheme={theme.scheme}
                  // Dark mode (Rovy): the selected tab sits in a darker inset pill, not a lighter lens.
                  tintColor={theme.scheme === 'dark' ? withAlpha(theme.colors.canvas, 0.55) : undefined}
                  style={{flex: 1, borderRadius: PILL_HEIGHT / 2}}
                />
              ) : (
                <View style={{flex: 1, borderRadius: PILL_HEIGHT / 2, backgroundColor: theme.colors.controlActive}} />
              )}
            </Animated.View>
          ) : null}
          <View style={{flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: BAR_PADDING}}>
            {state.routes.map((route, index) => {
              const focused = state.index === index;
              const {options} = descriptors[route.key];
              const onPress = () => goTo(index);
              return (
                <Pressable
                  key={route.key}
                  accessibilityRole="tab"
                  accessibilityState={{selected: focused}}
                  accessibilityLabel={options.title ?? route.name}
                  onPress={onPress}
                  style={{flex: 1, height: PILL_HEIGHT, alignItems: 'center', justifyContent: 'center'}}>
                  <Animated.View
                    style={{
                      width: 26,
                      height: 26,
                      // Magnified while the lens is held over it, fading out as the lens moves on.
                      transform: [
                        {
                          scale: Animated.add(
                            1,
                            Animated.multiply(held, position.interpolate({inputRange: [index - 1, index, index + 1], outputRange: [0, ICON_MAGNIFY, 0], extrapolate: 'clamp'})),
                          ),
                        },
                      ],
                    }}>
                  <TabIcon name={ICONS[route.name] ?? 'home'} color={theme.colors.textPrimary} />
                  {/* The accent copy follows the pill: fully on under it, fading as the pill leaves,
                      so the colour moves with a tap or a drag instead of switching at the end. */}
                  <Animated.View
                    style={{
                      position: 'absolute',
                      inset: 0,
                      opacity: position.interpolate({inputRange: [index - 1, index, index + 1], outputRange: [0, 1, 0], extrapolate: 'clamp'}),
                    }}>
                    <TabIcon name={ICONS[route.name] ?? 'home'} color={theme.colors.accent} />
                  </Animated.View>
                </Animated.View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}
