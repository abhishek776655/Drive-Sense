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
  success: '#16A34A',
  successSoft: 'rgba(22,163,74,0.12)',
  successMuted: 'rgba(22,163,74,0.08)',
  onAccent: '#FFFFFF',
  onAccentMuted: 'rgba(255,255,255,0.80)',
  warning: '#F59E0B',
  warningSoft: 'rgba(245,158,11,0.12)',
  danger: '#DC2626',
  dangerSoft: 'rgba(220,38,38,0.10)',
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
    sectionTitleSoft: {fontFamily: appFontSemiBold, fontSize: 14, lineHeight: 18, fontWeight: '600'},
    body: {fontFamily: appFontMedium, fontSize: 14, lineHeight: 20, fontWeight: '500'},
    caption: {fontFamily: appFontMedium, fontSize: 12, lineHeight: 16, fontWeight: '500'},
    metricValue: {fontFamily: appFontBold, fontSize: 20, lineHeight: 24, fontWeight: '700'},
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
