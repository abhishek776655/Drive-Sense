import React from 'react';
import {ActivityIndicator, Text, TouchableOpacity, View} from 'react-native';
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

/** The speedometer-arc brand mark. A driving mark, not a stock icon in a box. */
export const BrandMark: React.FC<{size?: number}> = ({size = 92}) => {
  const theme = useAppTheme();
  const arc = Math.round(size * 0.72);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 3,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.accentSoft,
        boxShadow: `0px 12px 22px ${theme.dark ? 'rgba(36,107,255,0.35)' : 'rgba(36,107,255,0.22)'}`,
      }}>
      <View
        style={{
          position: 'absolute',
          width: arc,
          height: arc,
          borderRadius: arc / 2,
          borderWidth: 5,
          borderTopColor: theme.accent,
          borderRightColor: theme.accent,
          borderLeftColor: theme.accent,
          borderBottomColor: 'transparent',
          transform: [{rotate: '45deg'}],
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: arc,
          height: arc,
          borderRadius: arc / 2,
          borderWidth: 5,
          borderTopColor: theme.accentSoft,
          borderRightColor: 'transparent',
          borderLeftColor: 'transparent',
          borderBottomColor: 'transparent',
          transform: [{rotate: '-45deg'}],
        }}
      />
      <View style={{width: 10, height: 10, borderRadius: 5, backgroundColor: theme.accent}} />
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
