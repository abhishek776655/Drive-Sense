import React from 'react';
import {ActivityIndicator, Image, Text, TouchableOpacity, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useAppTheme} from '../theme/appTheme';

/** Soft corner glows behind the sign-in and sign-up screens. */
export const AuthBackdrop: React.FC = () => {
  const theme = useAppTheme();

  return (
    <>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -120,
          left: -60,
          width: 280,
          height: 280,
          borderRadius: 140,
          backgroundColor: theme.screenGlow,
          opacity: theme.dark ? 0.6 : 0.9,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -40,
          right: -90,
          width: 220,
          height: 220,
          borderRadius: 110,
          backgroundColor: theme.accentSoft,
          opacity: theme.dark ? 0.5 : 0.7,
        }}
      />
    </>
  );
};

/**
 * The speedometer-arc brand mark — the actual app icon asset rather than a redrawn copy, so the
 * home-screen icon and the in-app mark cannot drift apart.
 */
export const BrandMark: React.FC<{size?: number}> = ({size = 92}) => {
  const theme = useAppTheme();

  return (
    // The shadow sits on a wrapper: React Native's ImageStyle has no boxShadow.
    <View
      style={{
        width: size,
        height: size,
        // Matches the iOS home-screen squircle closely enough to read as the same icon.
        borderRadius: size * 0.24,
        overflow: 'hidden',
        boxShadow: `0px 12px 22px ${theme.dark ? 'rgba(36,107,255,0.38)' : 'rgba(36,107,255,0.24)'}`,
      }}>
      <Image
        source={require('../../assets/brand-mark.png')}
        accessibilityIgnoresInvertColors
        accessibilityLabel="DriveSense"
        style={{width: '100%', height: '100%'}}
      />
    </View>
  );
};

/** The DriveSense wordmark. */
export const Wordmark: React.FC<{fontSize?: number}> = ({fontSize = 34}) => {
  const theme = useAppTheme();

  return (
    <View style={{flexDirection: 'row', alignItems: 'baseline'}}>
      <Text style={{color: theme.text, ...theme.typography.pageTitle, fontSize, lineHeight: fontSize * 1.18}}>Drive</Text>
      <Text style={{color: theme.accent, ...theme.typography.pageTitle, fontSize, lineHeight: fontSize * 1.18}}>Sense</Text>
    </View>
  );
};

/** Inline error banner used by both auth screens. */
export const AuthErrorBanner: React.FC<{message: string}> = ({message}) => {
  const theme = useAppTheme();

  return (
    <View
      accessibilityRole="alert"
      style={{
        marginBottom: 14,
        borderRadius: 16,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.dangerSoft,
        borderWidth: 1,
        borderColor: theme.danger,
      }}>
      <Ionicons name="alert-circle" size={16} color={theme.danger} />
      <Text style={{flex: 1, marginLeft: 8, color: theme.danger, ...theme.typography.caption, fontWeight: '700'}}>
        {message}
      </Text>
    </View>
  );
};

/** Primary call-to-action button. */
export const AuthPrimaryButton: React.FC<{
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}> = ({label, onPress, loading = false, disabled = false}) => {
  const theme = useAppTheme();
  const inactive = loading || disabled;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={inactive}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled: inactive, busy: loading}}
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 18,
        height: 54,
        backgroundColor: theme.accent,
        opacity: inactive ? 0.7 : 1,
        boxShadow: '0px 8px 16px rgba(36,107,255,0.28)',
      }}>
      {loading ? (
        <ActivityIndicator color={theme.onAccent} />
      ) : (
        <Text style={{color: theme.onAccent, ...theme.typography.body, fontWeight: '800', fontSize: 16}}>{label}</Text>
      )}
    </TouchableOpacity>
  );
};
