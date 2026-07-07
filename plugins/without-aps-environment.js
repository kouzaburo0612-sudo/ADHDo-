const { withEntitlementsPlist } = require('@expo/config-plugins');

/**
 * expo-notifications automatically adds the iOS `aps-environment` entitlement
 * (Push Notifications capability). This app only uses LOCAL notifications
 * (scheduled reminders) and never registers for remote push, so that entitlement
 * is unnecessary — and requiring it forces a push-capable provisioning profile /
 * APNs key at build time. This plugin removes it so the app builds without any
 * push credentials.
 */
module.exports = function withoutApsEnvironment(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
};
