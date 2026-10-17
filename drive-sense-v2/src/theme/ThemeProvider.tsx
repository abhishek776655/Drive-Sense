import {createContext, useContext, useMemo, type ReactNode} from 'react';
import {useColorScheme} from 'react-native';
import {useAppearanceStore} from './appearanceStore';
import {resolveScheme, themeFor, type AppTheme} from './theme';

const ThemeContext = createContext<AppTheme>(themeFor('dark'));

export function ThemeProvider({children}: {children: ReactNode}) {
  const preference = useAppearanceStore((state) => state.preference);
  const system = useColorScheme();
  const scheme = resolveScheme(preference, system);
  const theme = useMemo(() => themeFor(scheme), [scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export const useAppTheme = () => useContext(ThemeContext);
