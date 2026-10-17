import {Ionicons} from '@expo/vector-icons';
import {BlurView} from 'expo-blur';
import {LinearGradient} from 'expo-linear-gradient';
import {ActivityIndicator, Platform, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {withAlpha} from '../../theme/color';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {GlassButton} from '../GlassButton';

const BUTTON = 58;
/** Height of the blurred band above the buttons, so content fades out instead of being cut. */
const FADE = 56;
/** Stacked blur layers: the bottom is covered by all of them, the top by one, so blur ramps up. */
const BLUR_STEPS = 5;
/** Coloured glass, not paint: enough colour to read as the action, light enough to see through. */
const GLASS_TINT = 0.78;

/** Space the page leaves at the bottom so its last card can scroll clear of the bar. */
export const TRIP_ACTION_BAR_SPACE = BUTTON + FADE;

/**
 * Rovy-style floating actions over a progressive blur: Change vehicle and Delete. Content scrolls
 * underneath and blurs out toward the bottom edge.
 */
export function TripActionBar({onChangeVehicle, onDelete, busy, disabled}: {onChangeVehicle: () => void; onDelete: () => void; busy: boolean; disabled: boolean}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const bottom = insets.bottom + 8;
  const height = bottom + BUTTON + FADE;
  return (
    <View pointerEvents="box-none" style={{position: 'absolute', left: 0, right: 0, bottom: 0, height}}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {Array.from({length: BLUR_STEPS}, (_, i) => (
          <BlurView
            key={i}
            intensity={6}
            tint={c.glassBlurTint}
            blurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
            style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: height * ((BLUR_STEPS - i) / BLUR_STEPS)}}
          />
        ))}
        <LinearGradient
          colors={[withAlpha(c.canvas, 0), withAlpha(c.canvas, 0.55), withAlpha(c.canvas, 0.9)]}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={{position: 'absolute', left: theme.space.screen, right: theme.space.screen, bottom, flexDirection: 'row', gap: 12}}>
        <View style={{flex: 1}}>
          <GlassButton
            accessibilityLabel="Change vehicle"
            disabled={disabled || busy}
            onPress={onChangeVehicle}
            tint={withAlpha(c.accent, GLASS_TINT)}
            style={{height: BUTTON, flexDirection: 'row', gap: 10}}>
            {busy ? (
              <ActivityIndicator color={c.onAccent} />
            ) : (
              <>
                <Ionicons name="car-sport" size={20} color={c.onAccent} />
                <AppText size={16} weight="black" tone="onAccent">
                  Change Vehicle
                </AppText>
              </>
            )}
          </GlassButton>
        </View>
        <GlassButton accessibilityLabel="Delete drive" disabled={disabled || busy} onPress={onDelete} tint={withAlpha(c.red, GLASS_TINT)} style={{width: BUTTON, height: BUTTON}}>
          <Ionicons name="trash" size={22} color={c.onAccent} />
        </GlassButton>
      </View>
    </View>
  );
}
