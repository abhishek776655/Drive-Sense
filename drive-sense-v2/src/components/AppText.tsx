import {Text, type TextProps, type TextStyle} from 'react-native';
import {useAppTheme} from '../theme/ThemeProvider';

type Weight = 'semibold' | 'bold' | 'extrabold' | 'black';
type Tone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'onAccent';

interface AppTextProps extends TextProps {
  size?: number;
  weight?: Weight;
  tone?: Tone;
  color?: string;
}

/** Nunito at the spec's weights; colour comes from tokens unless a token colour is passed in. */
export function AppText({size = 15, weight = 'bold', tone = 'primary', color, style, ...rest}: AppTextProps) {
  const theme = useAppTheme();
  const tones: Record<Tone, string> = {
    primary: theme.colors.textPrimary,
    secondary: theme.colors.textSecondary,
    tertiary: theme.colors.textTertiary,
    accent: theme.colors.accent,
    onAccent: theme.colors.onAccent,
  };
  const base: TextStyle = {fontFamily: theme.font[weight], fontSize: size, color: color ?? tones[tone]};
  return <Text {...rest} style={[base, style]} />;
}
