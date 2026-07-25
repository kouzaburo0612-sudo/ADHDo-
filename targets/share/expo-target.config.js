/** @type {import('@bacons/apple-targets/app.plugin').Config} */
// 共有シート(Share Extension)。Chrome/Safari/YouTube/写真から
// テキスト・URL・画像をInboxへ即保存して閉じる(UIなし・摩擦ゼロ)
// 注意: ターゲット名は本体(ADHDo)・ウィジェット(ADHDoWidget)と重複させないこと
module.exports = {
  type: 'share',
  name: 'ADHDoShare',
  deploymentTarget: '17.0',
  entitlements: {
    'com.apple.security.application-groups': ['group.com.kozaburookuda.adhdo'],
  },
};
