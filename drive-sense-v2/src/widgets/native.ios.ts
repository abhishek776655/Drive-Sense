import {requireOptionalNativeModule} from 'expo';
import type {WidgetsNative} from './native';

export type {ActivityHandle, WidgetsNative} from './native';

let loaded: WidgetsNative | null | undefined;

/**
 * The Live Activity and widget, loaded on first use. Expo Go has no `expo-widgets` native module,
 * so it is looked up first and never required there (requiring it would throw, and in development
 * Metro reports a module that throws while loading even when the caller catches it). Requiring the
 * layouts also registers them with the widget extension on a dev build.
 */
export const widgetsNative = (): WidgetsNative | null => {
  if (loaded === undefined) {
    if (requireOptionalNativeModule('ExpoWidgets') == null) {
      loaded = null;
      return null;
    }
    try {
      /* eslint-disable @typescript-eslint/no-require-imports */
      const {after} = require('expo-widgets');
      loaded = {
        activity: require('./DriveActivity.ios').default,
        week: require('./DriveWeekWidget.ios').default,
        after,
      };
      /* eslint-enable @typescript-eslint/no-require-imports */
    } catch {
      loaded = null;
    }
  }
  return loaded ?? null;
};
