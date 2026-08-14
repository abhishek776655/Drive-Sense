import React, {useEffect, useRef, useState} from 'react';
import {Animated, Platform, Pressable, Text, TextInput, View, type TextInputProps} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useAppTheme} from '../theme/appTheme';

type Props = Omit<TextInputProps, 'style'> & {
  icon: keyof typeof Ionicons.glyphMap;
  /** Renders a show/hide toggle and starts masked. */
  secure?: boolean;
  /** Field-level validation message. Turns the border red and reserves a line beneath. */
  error?: string | null;
  marginBottom?: number;
};

const FIELD_HEIGHT = 54;
const BORDER_WIDTH = 1.5;
const FOCUS_DURATION_MS = 150;

/**
 * The one text field used by the sign-in and sign-up screens.
 *
 * Cross-platform input hygiene lives here rather than at each call site: web draws its own focus
 * ring on top of the custom border, Android draws an underline and its own font padding, and a
 * `lineHeight` on a `TextInput` clips descenders on Android. All of that is neutralised once.
 */
export const AuthTextField: React.FC<Props> = ({
  icon,
  secure = false,
  error,
  marginBottom = 12,
  ...inputProps
}) => {
  const theme = useAppTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const focusProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Colour cannot animate on the native driver, but this is a single 150ms border tween on an
    // otherwise idle screen — cheap, and it stops the border snapping between states.
    const animation = Animated.timing(focusProgress, {
      toValue: focused ? 1 : 0,
      duration: FOCUS_DURATION_MS,
      useNativeDriver: false,
    });
    animation.start();

    // Blurring a field mid-tween, or unmounting the screen on submit, would otherwise leave the
    // timer driving a value nobody is rendering any more.
    return () => animation.stop();
  }, [focused, focusProgress]);

  // Error outranks focus: a red border that turns blue on focus would hide the problem exactly
  // when the user returns to fix it.
  const borderColor = error
    ? theme.danger
    : focusProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [theme.cardBorder, theme.accent],
      });
  const iconColor = error ? theme.danger : focused ? theme.accent : theme.textSubtle;

  return (
    <View style={{marginBottom}}>
      <Animated.View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 18,
          borderWidth: BORDER_WIDTH,
          paddingHorizontal: 16,
          height: FIELD_HEIGHT,
          backgroundColor: theme.card,
          borderColor,
        }}>
        <Ionicons name={icon} size={18} color={iconColor} />
        <TextInput
          {...inputProps}
          style={[
            {
              flex: 1,
              marginLeft: 12,
              color: theme.text,
              fontFamily: theme.typography.body.fontFamily,
              fontSize: theme.typography.body.fontSize,
              // Deliberately no lineHeight: on Android it clips descenders inside a TextInput.
              padding: 0,
              // Keeps the caret and text centred in the fixed-height row on Android.
              textAlignVertical: 'center',
              includeFontPadding: false,
            },
            // RN Web paints a browser focus ring over the custom border.
            Platform.OS === 'web' ? ({outlineStyle: 'none', outlineWidth: 0} as object) : null,
          ]}
          placeholderTextColor={theme.textSubtle}
          secureTextEntry={secure && !revealed}
          underlineColorAndroid="transparent"
          selectionColor={theme.accent}
          // Password managers on Android otherwise re-enable autocorrect over a masked field.
          autoCorrect={inputProps.autoCorrect ?? !secure}
          onFocus={(event) => {
            setFocused(true);
            inputProps.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            inputProps.onBlur?.(event);
          }}
        />
        {secure ? (
          <Pressable
            onPress={() => setRevealed((current) => !current)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            // Fixed width so toggling the icon cannot nudge the text field's width.
            style={{width: 24, alignItems: 'flex-end'}}>
            <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.textSubtle} />
          </Pressable>
        ) : null}
      </Animated.View>
      {error ? (
        <Text style={{color: theme.danger, ...theme.typography.caption, marginTop: 6, marginLeft: 4}}>{error}</Text>
      ) : null}
    </View>
  );
};
