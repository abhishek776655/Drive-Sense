import type {ReactNode} from 'react';
import {ActivityIndicator, Pressable, RefreshControl, View} from 'react-native';
import {useRecordingStore} from '../stores/recordingStore';
import {useAppTheme} from '../theme/ThemeProvider';
import {AppText} from './AppText';
import {StickyHeaderScroll} from './StickyHeaderScroll';
import {useTabBarInset} from './tabBarLayout';

interface ListScreenProps {
  kicker: string;
  title: string;
  loading: boolean;
  error: string | null;
  empty: string;
  isEmpty: boolean;
  onRefresh: () => void;
  children: ReactNode;
}

/** Shared shell for the interim Logbook and Garage tabs until their own v2 specs land. */
export function ListScreen({kicker, title, loading, error, empty, isEmpty, onRefresh, children}: ListScreenProps) {
  const theme = useAppTheme();
  const live = useRecordingStore((s) => s.status !== 'ready');
  const bottomInset = useTabBarInset(live);
  return (
    <StickyHeaderScroll
      kicker={kicker}
      title={title}
      contentContainerStyle={{paddingBottom: bottomInset, gap: theme.space.cardGap}}
      refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={theme.colors.accent} />}>
      {error ? (
        <Pressable accessibilityRole="button" onPress={onRefresh} style={{backgroundColor: theme.colors.accentTint, borderRadius: 16, padding: 12}}>
          <AppText size={13} weight="bold" tone="accent">
            {error} Tap to retry.
          </AppText>
        </Pressable>
      ) : null}
      {loading && isEmpty ? <ActivityIndicator color={theme.colors.accent} style={{marginTop: 24}} /> : null}
      {!loading && !error && isEmpty ? (
        <View style={{alignItems: 'center', paddingVertical: 40}}>
          <AppText size={14} weight="bold" tone="secondary">
            {empty}
          </AppText>
        </View>
      ) : null}
      {children}
    </StickyHeaderScroll>
  );
}
