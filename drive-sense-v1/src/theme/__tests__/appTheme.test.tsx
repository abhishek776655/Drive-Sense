import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Text} from 'react-native';
import {act, render, screen, waitFor} from '@testing-library/react-native';
import {useColorScheme} from 'react-native';
import {ThemeProvider, useThemeMode} from '../appTheme';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

const mockedColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

const Probe: React.FC = () => {
  const {mode, preference} = useThemeMode();

  return <Text>{`${preference}:${mode}`}</Text>;
};

const renderProvider = () =>
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );

describe('ThemeProvider', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockedColorScheme.mockReturnValue('light');
    await AsyncStorage.clear();
  });

  it('defaults to system and resolves against the device scheme', async () => {
    mockedColorScheme.mockReturnValue('dark');
    renderProvider();

    await waitFor(() => expect(screen.getByText('system:dark')).toBeTruthy());
  });

  it('restores a stored explicit preference', async () => {
    await AsyncStorage.setItem('theme_mode', 'dark');
    renderProvider();

    await waitFor(() => expect(screen.getByText('dark:dark')).toBeTruthy());
  });

  it('ignores an unrecognised stored value and stays on system', async () => {
    await AsyncStorage.setItem('theme_mode', 'sepia');
    renderProvider();

    await waitFor(() => expect(screen.getByText('system:light')).toBeTruthy());
  });

  it('keeps an explicit preference regardless of the device scheme', async () => {
    mockedColorScheme.mockReturnValue('dark');
    await AsyncStorage.setItem('theme_mode', 'light');
    renderProvider();

    await waitFor(() => expect(screen.getByText('light:light')).toBeTruthy());
  });

  it('persists a new preference', async () => {
    let setPreference: ((next: 'system' | 'light' | 'dark') => Promise<void>) | undefined;
    const Capture: React.FC = () => {
      setPreference = useThemeMode().setThemePreference;
      return null;
    };
    render(
      <ThemeProvider>
        <Probe />
        <Capture />
      </ThemeProvider>,
    );

    await act(async () => {
      await setPreference?.('dark');
    });

    expect(screen.getByText('dark:dark')).toBeTruthy();
    await waitFor(async () => expect(await AsyncStorage.getItem('theme_mode')).toBe('dark'));
  });
});
