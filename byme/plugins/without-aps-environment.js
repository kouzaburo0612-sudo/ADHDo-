const { withEntitlementsPlist } = require('@expo/config-plugins');

/**
 * expo-notifications is prebuilt with the iOS `aps-environment` entitlement
 * (Push Notifications capability). BYME only uses LOCAL notifications
 * (morning affirmation + journal reminder) and never registers for remote
 * push, so that entitlement is unnecessary — and requiring it forces a
 * push-capable provisioning profile / APNs key at build time. This plugin
 * removes it so the app builds with the plain App Store profile generated
 * by the CI workflow.
 */
module.exports = function withoutApsEnvironment(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
};
