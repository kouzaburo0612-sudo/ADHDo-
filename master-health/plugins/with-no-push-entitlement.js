/**
 * expo-notificationsが自動付与する aps-environment entitlement を除去する。
 * VYTAはローカル通知のみ使用し、リモートプッシュは使わないため
 * Push Notifications capabilityの無いプロビジョニングプロファイルで署名できるようにする。
 * (プラグイン配列の最後、expo-notificationsより後に置くこと)
 */
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withNoPushEntitlement(config) {
  return withEntitlementsPlist(config, (mod) => {
    delete mod.modResults['aps-environment'];
    return mod;
  });
};
