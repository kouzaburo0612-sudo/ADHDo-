# ブランドアセット

依頼者(奥田さん)支給の元画像から生成・配置済み。

| ファイル名 | 用途 |
|---|---|
| `logo.png` | 横ロゴ(執事+Alfy+タグライン)— ホーム画面ヒーロー |
| `icon-512.png` | PWAアイコン 512×512 / manifest |
| `icon-192.png` | PWAアイコン 192×192 / favicon / フッター |
| `apple-touch-icon.png` | iOSホーム画面追加用 180×180 |

差し替える場合は同名で上書きしてください。
アプリ(alfy-app)のストア用アイコンが必要になったら、元画像(1024×1024推奨)から
`npx @capacitor/assets generate` で生成します。
