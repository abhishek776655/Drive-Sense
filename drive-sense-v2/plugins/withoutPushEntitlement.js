const fs = require('fs');
const path = require('path');
const plist = require('@expo/plist').default;
const {withFinalizedMod} = require('expo/config-plugins');

/**
 * The app only schedules local notifications ("Drive saved", "You forgot to end your drive"), so it
 * needs no push capability. expo-notifications adds `aps-environment` anyway, and personal (free)
 * Apple teams cannot sign it. This runs after every other mod has written the entitlements file and
 * takes the key back out.
 */
module.exports = function withoutPushEntitlement(config) {
  return withFinalizedMod(config, [
    'ios',
    (cfg) => {
      const root = cfg.modRequest.platformProjectRoot;
      const name = cfg.modRequest.projectName;
      const file = path.join(root, name, `${name}.entitlements`);
      if (fs.existsSync(file)) {
        const entitlements = plist.parse(fs.readFileSync(file, 'utf8'));
        if ('aps-environment' in entitlements) {
          delete entitlements['aps-environment'];
          fs.writeFileSync(file, plist.build(entitlements));
        }
      }
      return cfg;
    },
  ]);
};
