/** @type {import('@bacons/apple-targets/app.plugin').Config} */
// ホーム画面ウィジェット(WidgetKit)ターゲット。
// アプリ本体とは App Group (group.com.kozaburookuda.adhdo) 経由でデータを共有する
module.exports = {
  type: 'widget',
  // 注意: 本体ターゲット(ADHDo)と同名にするとEASの署名割り当てが衝突する
  name: 'ADHDoWidget',
  deploymentTarget: '17.0',
  entitlements: {
    'com.apple.security.application-groups': ['group.com.kozaburookuda.adhdo'],
  },
};
