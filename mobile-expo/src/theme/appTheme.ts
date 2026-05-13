import {useColorScheme} from 'react-native';

export type AppTheme = {
  dark: boolean;
  typography: {
    pageTitle: {fontFamily: string; fontSize: number; lineHeight: number; fontWeight: '400' | '500' | '600' | '700' | '800' | '900'};
    sectionTitle: {fontFamily: string; fontSize: number; lineHeight: number; fontWeight: '400' | '500' | '600' | '700' | '800' | '900'};
    body: {fontFamily: string; fontSize: number; lineHeight: number; fontWeight: '400' | '500' | '600' | '700' | '800' | '900'};
    caption: {fontFamily: string; fontSize: number; lineHeight: number; fontWeight: '400' | '500' | '600' | '700' | '800' | '900'};
    metricValue: {fontFamily: string; fontSize: number; lineHeight: number; fontWeight: '400' | '500' | '600' | '700' | '800' | '900'};
    scoreValue: {fontFamily: string; fontSize: number; lineHeight: number; fontWeight: '400' | '500' | '600' | '700' | '800' | '900'};
  };
  screen: string;
  screenGlow: string;
  card: string;
  cardSoft: string;
  cardBorder: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  accent: string;
  accentSoft: string;
  accentMuted: string;
  success: string;
  successSoft: string;
  successMuted: string;
  onAccent: string;
  onAccentMuted: string;
  warning: string;
  danger: string;
  chip: string;
  chipText: string;
  line: string;
  lineMuted: string;
  onSuccess: string;
  onSuccessMuted: string;
};

const appFontMedium = 'Nunito_500Medium';
const appFontBold = 'Nunito_700Bold';
const appFontExtraBold = 'Nunito_800ExtraBold';

const lightTheme: AppTheme = {
  dark: false,
  typography: {
    pageTitle: {fontFamily: appFontExtraBold, fontSize: 28, lineHeight: 34, fontWeight: '800'},
    sectionTitle: {fontFamily: appFontBold, fontSize: 15, lineHeight: 20, fontWeight: '700'},
    body: {fontFamily: appFontMedium, fontSize: 14, lineHeight: 20, fontWeight: '500'},
    caption: {fontFamily: appFontMedium, fontSize: 11, lineHeight: 14, fontWeight: '500'},
    metricValue: {fontFamily: appFontBold, fontSize: 20, lineHeight: 24, fontWeight: '700'},
    scoreValue: {fontFamily: appFontExtraBold, fontSize: 56, lineHeight: 58, fontWeight: '800'},
  },
  screen: '#F4F7FB',
  screenGlow: '#EAF1FF',
  card: '#FFFFFF',
  cardSoft: '#F8FAFF',
  cardBorder: '#E8EEF7',
  text: '#0F172A',
  textMuted: '#334155',
  textSubtle: '#6B7280',
  accent: '#246BFF',
  accentSoft: 'rgba(36,107,255,0.12)',
  accentMuted: 'rgba(36,107,255,0.06)',
  success: '#16A34A',
  successSoft: 'rgba(22,163,74,0.12)',
  successMuted: 'rgba(22,163,74,0.08)',
  onAccent: '#FFFFFF',
  onAccentMuted: 'rgba(255,255,255,0.80)',
  warning: '#F59E0B',
  danger: '#DC2626',
  chip: '#EEF4FF',
  chipText: '#246BFF',
  line: '#246BFF',
  lineMuted: '#94A3B8',
  onSuccess: '#FFFFFF',
  onSuccessMuted: 'rgba(255,255,255,0.80)',
};

const darkTheme: AppTheme = {
  ...lightTheme,
  dark: true,
  typography: {
    pageTitle: {fontFamily: appFontExtraBold, fontSize: 28, lineHeight: 34, fontWeight: '800'},
    sectionTitle: {fontFamily: appFontBold, fontSize: 15, lineHeight: 20, fontWeight: '700'},
    body: {fontFamily: appFontMedium, fontSize: 14, lineHeight: 20, fontWeight: '500'},
    caption: {fontFamily: appFontMedium, fontSize: 11, lineHeight: 14, fontWeight: '500'},
    metricValue: {fontFamily: appFontBold, fontSize: 20, lineHeight: 24, fontWeight: '700'},
    scoreValue: {fontFamily: appFontExtraBold, fontSize: 56, lineHeight: 58, fontWeight: '800'},
  },
  screen: '#050B16',
  screenGlow: '#0B1630',
  card: '#101826',
  cardSoft: '#121B2A',
  cardBorder: 'rgba(255,255,255,0.08)',
  text: '#F8FAFC',
  textMuted: '#D6DBE7',
  textSubtle: '#8A93A6',
  accent: '#246BFF',
  accentSoft: 'rgba(36,107,255,0.18)',
  accentMuted: 'rgba(36,107,255,0.08)',
  success: '#22C55E',
  successSoft: 'rgba(34,197,94,0.18)',
  successMuted: 'rgba(34,197,94,0.12)',
  onAccent: '#FFFFFF',
  onAccentMuted: 'rgba(255,255,255,0.80)',
  chip: 'rgba(255,255,255,0.06)',
  chipText: '#D6E4FF',
  line: '#246BFF',
  lineMuted: 'rgba(255,255,255,0.28)',
  onSuccess: '#FFFFFF',
  onSuccessMuted: 'rgba(255,255,255,0.80)',
};

export const getAppTheme = (darkMode: boolean) => (darkMode ? darkTheme : lightTheme);

export const useAppTheme = () => getAppTheme(useColorScheme() === 'dark');
