import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {useColorScheme} from 'react-native';

export type AppTheme = {
  dark: boolean;
  typography: {
    pageTitle: {fontFamily: string; fontSize: number; lineHeight: number; fontWeight: '400' | '500' | '600' | '700' | '800' | '900'};
    sectionTitle: {fontFamily: string; fontSize: number; lineHeight: number; fontWeight: '400' | '500' | '600' | '700' | '800' | '900'};
    sectionTitleSoft: {fontFamily: string; fontSize: number; lineHeight: number; fontWeight: '400' | '500' | '600' | '700' | '800' | '900'};
    body: {fontFamily: string; fontSize: number; lineHeight: number; fontWeight: '400' | '500' | '600' | '700' | '800' | '900'};
    caption: {fontFamily: string; fontSize: number; lineHeight: number; fontWeight: '400' | '500' | '600' | '700' | '800' | '900'};
    metricValue: {fontFamily: string; fontSize: number; lineHeight: number; fontWeight: '400' | '500' | '600' | '700' | '800' | '900'};
    /** Borderless inline stats sitting in a row, where a boxed metric would be too heavy. */
    statInline: {fontFamily: string; fontSize: number; lineHeight: number; fontWeight: '400' | '500' | '600' | '700' | '800' | '900'};
    /** Card headings. One weight step below the hero so the hero still leads. */
    cardTitle: {fontFamily: string; fontSize: number; lineHeight: number; fontWeight: '400' | '500' | '600' | '700' | '800' | '900'};
    /** Units rendered as their own Text beside a value, never inside the value string. */
    unit: {fontFamily: string; fontSize: number; lineHeight: number; fontWeight: '400' | '500' | '600' | '700' | '800' | '900'};
    statHero: {fontFamily: string; fontSize: number; lineHeight: number; fontWeight: '400' | '500' | '600' | '700' | '800' | '900'};
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
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  chip: string;
  chipText: string;
  line: string;
  lineMuted: string;
  onSuccess: string;
  onSuccessMuted: string;
  /** Label colour for text sitting on a `danger` fill. Dark themes need dark ink, not white. */
  onDanger: string;
  /** Label colour for text sitting on a `warning` fill. */
  onWarning: string;
  /** Translucent surface for controls floating on top of a map or photo. */
  overlay: string;
  overlayBorder: string;
  /** Selected state for those floating controls. */
  overlayActive: string;
  /** Dimming layer behind a drawer or modal. */
  scrim: string;
  /**
   * Soft drop shadow for raised surfaces, as a CSS-style `boxShadow`.
   *
   * Deliberately not the legacy `shadow*` / `elevation` pair: those render nothing on Android
   * (which only honours `elevation`), and `elevation` draws a rectangular shadow that ignores
   * `borderRadius`, so it escapes the rounded corners of a card. `boxShadow` follows the border
   * radius on iOS, Android and web alike (React Native 0.76+ on the New Architecture).
   */
  cardShadow: {boxShadow: string};
  /** Lighter shadow for nested or secondary surfaces that must not compete with a real card. */
  cardShadowSubtle: {boxShadow: string};
};

type ThemeMode = 'light' | 'dark';

type ThemeContextValue = {
  mode: ThemeMode;
  theme: AppTheme;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleThemeMode: () => Promise<void>;
};

const THEME_MODE_KEY = 'theme_mode';

const appFontMedium = 'Nunito_500Medium';
const appFontSemiBold = 'Nunito_600SemiBold';
const appFontBold = 'Nunito_700Bold';
const appFontExtraBold = 'Nunito_800ExtraBold';

const lightTheme: AppTheme = {
  dark: false,
  typography: {
    pageTitle: {fontFamily: appFontExtraBold, fontSize: 28, lineHeight: 34, fontWeight: '800'},
    sectionTitle: {fontFamily: appFontBold, fontSize: 15, lineHeight: 20, fontWeight: '700'},
    sectionTitleSoft: {fontFamily: appFontSemiBold, fontSize: 14, lineHeight: 18, fontWeight: '600'},
    body: {fontFamily: appFontMedium, fontSize: 14, lineHeight: 20, fontWeight: '500'},
    caption: {fontFamily: appFontMedium, fontSize: 12, lineHeight: 16, fontWeight: '500'},
    metricValue: {fontFamily: appFontBold, fontSize: 20, lineHeight: 24, fontWeight: '700'},
    statInline: {fontFamily: appFontBold, fontSize: 17, lineHeight: 22, fontWeight: '700'},
    cardTitle: {fontFamily: appFontBold, fontSize: 18, lineHeight: 24, fontWeight: '700'},
    unit: {fontFamily: appFontSemiBold, fontSize: 11, lineHeight: 14, fontWeight: '600'},
    statHero: {fontFamily: appFontExtraBold, fontSize: 38, lineHeight: 42, fontWeight: '800'},
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
  success: '#2F7D57',
  successSoft: 'rgba(47,125,87,0.12)',
  successMuted: 'rgba(47,125,87,0.08)',
  onAccent: '#FFFFFF',
  onAccentMuted: 'rgba(255,255,255,0.80)',
  warning: '#8A6520',
  warningSoft: 'rgba(138,101,32,0.12)',
  danger: '#B4433D',
  dangerSoft: 'rgba(180,67,61,0.10)',
  chip: '#EEF4FF',
  chipText: '#246BFF',
  line: '#246BFF',
  lineMuted: '#94A3B8',
  onSuccess: '#FFFFFF',
  onSuccessMuted: 'rgba(255,255,255,0.80)',
  onDanger: '#FFFFFF',
  onWarning: '#FFFFFF',
  overlay: 'rgba(255,255,255,0.82)',
  overlayBorder: 'rgba(15,23,42,0.10)',
  overlayActive: 'rgba(36,107,255,0.92)',
  scrim: 'rgba(15,23,42,0.42)',
  // Offset well below the blur radius, so the shadow reads as a soft lift rather than a hard
  // drop. Slate-tinted rather than pure black — black over a blue-grey screen looks muddy.
  cardShadow: {boxShadow: '0px 4px 14px rgba(15, 23, 42, 0.07)'},
  cardShadowSubtle: {boxShadow: '0px 2px 6px rgba(15, 23, 42, 0.05)'},
};

const darkTheme: AppTheme = {
  ...lightTheme,
  dark: true,
  typography: {
    pageTitle: {fontFamily: appFontExtraBold, fontSize: 28, lineHeight: 34, fontWeight: '800'},
    sectionTitle: {fontFamily: appFontBold, fontSize: 15, lineHeight: 20, fontWeight: '700'},
    sectionTitleSoft: {fontFamily: appFontSemiBold, fontSize: 14, lineHeight: 18, fontWeight: '600'},
    body: {fontFamily: appFontMedium, fontSize: 14, lineHeight: 20, fontWeight: '500'},
    caption: {fontFamily: appFontMedium, fontSize: 12, lineHeight: 16, fontWeight: '500'},
    metricValue: {fontFamily: appFontBold, fontSize: 20, lineHeight: 24, fontWeight: '700'},
    statInline: {fontFamily: appFontBold, fontSize: 17, lineHeight: 22, fontWeight: '700'},
    cardTitle: {fontFamily: appFontBold, fontSize: 18, lineHeight: 24, fontWeight: '700'},
    unit: {fontFamily: appFontSemiBold, fontSize: 11, lineHeight: 14, fontWeight: '600'},
    statHero: {fontFamily: appFontExtraBold, fontSize: 38, lineHeight: 42, fontWeight: '800'},
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
  success: '#5BAF85',
  successSoft: 'rgba(91,175,133,0.18)',
  successMuted: 'rgba(91,175,133,0.12)',
  warning: '#C79A62',
  warningSoft: 'rgba(199,154,98,0.18)',
  danger: '#C97A75',
  dangerSoft: 'rgba(201,122,117,0.16)',
  onAccent: '#FFFFFF',
  onAccentMuted: 'rgba(255,255,255,0.80)',
  chip: 'rgba(255,255,255,0.06)',
  chipText: '#D6E4FF',
  line: '#246BFF',
  lineMuted: 'rgba(255,255,255,0.28)',
  // A status fill in dark mode is a light colour, so its label has to be dark ink.
  onSuccess: '#12100F',
  onSuccessMuted: 'rgba(18,16,15,0.72)',
  onDanger: '#12100F',
  onWarning: '#12100F',
  overlay: 'rgba(16,24,38,0.74)',
  overlayBorder: 'rgba(255,255,255,0.16)',
  overlayActive: 'rgba(36,107,255,0.90)',
  scrim: 'rgba(2,6,14,0.58)',
  // Pure black: a soft grey blur is invisible against a near-black screen. Kept tight and modest
  // so it deepens the card edge instead of haloing it.
  cardShadow: {boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.28)'},
  cardShadowSubtle: {boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.18)'},
};

export const getAppTheme = (darkMode: boolean) => (darkMode ? darkTheme : lightTheme);

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const colorScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>(colorScheme === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    let mounted = true;

    const hydrateThemeMode = async () => {
      try {
        const storedMode = await AsyncStorage.getItem(THEME_MODE_KEY);
        if (!mounted) {
          return;
        }
        if (storedMode === 'light' || storedMode === 'dark') {
          setMode(storedMode);
        }
      } catch {
        // Keep the current mode if stored preferences are unavailable.
      }
    };

    void hydrateThemeMode();

    return () => {
      mounted = false;
    };
  }, []);

  const setThemeMode = useCallback(async (nextMode: ThemeMode) => {
    setMode(nextMode);
    try {
      await AsyncStorage.setItem(THEME_MODE_KEY, nextMode);
    } catch {
      // The visual change should still apply for this session if persistence fails.
    }
  }, []);

  const toggleThemeMode = useCallback(async () => {
    const nextMode = mode === 'dark' ? 'light' : 'dark';
    await setThemeMode(nextMode);
  }, [mode, setThemeMode]);

  const value = useMemo(
    () => ({
      mode,
      theme: getAppTheme(mode === 'dark'),
      setThemeMode,
      toggleThemeMode,
    }),
    [mode, setThemeMode, toggleThemeMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeProvider');
  }
  return context;
};

export const useAppTheme = () => {
  const context = useContext(ThemeContext);
  return context?.theme ?? getAppTheme(useColorScheme() === 'dark');
};
