import {useSafeAreaInsets} from 'react-native-safe-area-context';

export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_GAP = 8;
export const BANNER_HEIGHT = 52;

export const tabBarBottom = (safeBottom: number) => Math.max(safeBottom, 12) + TAB_BAR_GAP - 8;

/**
 * Bottom inset for scroll content: the bar's own height + its offset + the safe area, plus the
 * mini banner while a drive is live. Derived from the same numbers the bar uses, never typed twice.
 */
export const useTabBarInset = (bannerVisible = false) => {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + tabBarBottom(insets.bottom) + (bannerVisible ? BANNER_HEIGHT + TAB_BAR_GAP : 0) + 16;
};
