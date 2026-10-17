const {withAppDelegate, withInfoPlist} = require('expo/config-plugins');

/**
 * iOS 27 stops any app at launch that has not adopted the UIScene life cycle. Expo ships the scene
 * delegate (`ExpoAppSceneDelegate`, which creates the window and starts React Native into it), but
 * the SDK 57 template still builds the window in the app delegate. This plugin switches the app over:
 * - Info.plist gets a scene manifest naming `EXExpoAppSceneDelegate`.
 * - AppDelegate conforms to `ExpoReactNativeFactoryProvider` and no longer makes its own window.
 * Remove it once the Expo template adopts scenes itself.
 */
const WINDOW_BLOCK = /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/;

module.exports = function withSceneLifecycle(config) {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [{UISceneConfigurationName: 'Default Configuration', UISceneDelegateClassName: 'EXExpoAppSceneDelegate'}],
      },
    };
    return cfg;
  });
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('withSceneLifecycle expects a Swift AppDelegate.');
    }
    let src = cfg.modResults.contents;
    if (!src.includes('ExpoReactNativeFactoryProvider')) {
      src = src.replace('class AppDelegate: ExpoAppDelegate {', 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {');
    }
    if (WINDOW_BLOCK.test(src)) {
      src = src.replace(WINDOW_BLOCK, '\n    // The scene delegate (EXExpoAppSceneDelegate) creates the window and starts React Native.\n');
    }
    if (!src.includes('ExpoReactNativeFactoryProvider') || src.includes('UIWindow(frame:')) {
      throw new Error('withSceneLifecycle could not update AppDelegate.swift; the template changed.');
    }
    cfg.modResults.contents = src;
    return cfg;
  });
};
