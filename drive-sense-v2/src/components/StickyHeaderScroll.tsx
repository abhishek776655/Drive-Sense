import {BlurView} from 'expo-blur';
import {LinearGradient} from 'expo-linear-gradient';
import {useState, type ReactElement, type ReactNode} from 'react';
import {Animated, Platform, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent, type RefreshControlProps, type StyleProp, type ViewStyle} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {withAlpha} from '../theme/color';
import {useAppTheme} from '../theme/ThemeProvider';
import {ScreenHeader} from './ScreenHeader';

/** Title block height (kicker + title + margin), below the safe area. */
const HEADER_HEIGHT = 106;
/** Short fade below the title so cards blur in gradually instead of at a hard line. */
const FADE_HEIGHT = 14;
/** Scroll distance over which the blur fades in; at rest nothing under the title is blurred. */
const BLUR_IN_DISTANCE = 24;
/** Stacked blur layers: the top is covered by all of them, the bottom by one, so blur ramps up. */
const BLUR_STEPS = 6;

interface StickyHeaderScrollProps {
  kicker: string;
  title: string;
  children: ReactNode;
  refreshControl?: ReactElement<RefreshControlProps>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Called while the user is near the end (load the next page); the callee ignores repeats. */
  onNearEnd?: () => void;
  /** On a pushed screen: a back button takes the gear's place. */
  onBack?: () => void;
  /** Presented as a sheet: a ✕ closes it, and the header sits below the sheet's own top edge. */
  sheet?: boolean;
}

/** How close to the end, in points, counts as near the end. */
const NEAR_END = 400;

/**
 * A tab screen whose "My / Title" header (with the Settings gear) stays pinned while the content
 * scrolls underneath it through a progressive blur and a fade to the background colour.
 */
export function StickyHeaderScroll({kicker, title, children, refreshControl, contentContainerStyle, onNearEnd, onBack, sheet}: StickyHeaderScrollProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  // An iOS sheet starts below the status bar; full screen (or Android) clears it.
  const top = sheet && Platform.OS === 'ios' ? 18 : insets.top + 8;
  const blurred = top + HEADER_HEIGHT - 12 + FADE_HEIGHT;
  const [scrollY] = useState(() => new Animated.Value(0));
  const blurOpacity = scrollY.interpolate({inputRange: [0, BLUR_IN_DISTANCE], outputRange: [0, 1], extrapolate: 'clamp'});

  return (
    <View style={{flex: 1, backgroundColor: theme.colors.canvas}}>
      <Animated.ScrollView
        style={{flex: 1}}
        scrollEventThrottle={16}
        onScroll={Animated.event([{nativeEvent: {contentOffset: {y: scrollY}}}], {
          useNativeDriver: true,
          listener: onNearEnd
            ? (e: NativeSyntheticEvent<NativeScrollEvent>) => {
                const {layoutMeasurement, contentOffset, contentSize} = e.nativeEvent;
                if (layoutMeasurement.height + contentOffset.y >= contentSize.height - NEAR_END) {
                  onNearEnd();
                }
              }
            : undefined,
        })}
        scrollIndicatorInsets={{top: top + HEADER_HEIGHT}}
        contentContainerStyle={[{paddingTop: top + HEADER_HEIGHT, paddingHorizontal: theme.space.screen}, contentContainerStyle]}
        refreshControl={refreshControl}>
        {children}
      </Animated.ScrollView>

      <View pointerEvents="box-none" style={{position: 'absolute', left: 0, right: 0, top: 0, height: blurred}}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {opacity: blurOpacity}]}>
          {Array.from({length: BLUR_STEPS}, (_, i) => (
            <BlurView
              key={i}
              intensity={7}
              tint={theme.colors.glassBlurTint}
              blurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
              style={{position: 'absolute', left: 0, right: 0, top: 0, height: blurred * ((BLUR_STEPS - i) / BLUR_STEPS)}}
            />
          ))}
          <LinearGradient
            colors={[withAlpha(theme.colors.canvas, 0.92), withAlpha(theme.colors.canvas, 0.6), withAlpha(theme.colors.canvas, 0)]}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <View style={{paddingTop: top, paddingHorizontal: theme.space.screen}}>
          <ScreenHeader kicker={kicker} title={title} onBack={onBack} backIcon={sheet ? 'close' : 'chevron-back'} />
        </View>
      </View>
    </View>
  );
}
