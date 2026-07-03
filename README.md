# ADHDo

**By ADHD. For ADHD.**

ADHDのための1日タイムスケジュール管理アプリ。

## 構成(1つのコードベースで2つの形)

```
prototype/index.html   アプリ本体(Web版)← 機能はすべてここに実装
App.js                 Expo版シェル: Web版をWebViewで表示し、ネイティブ機能を追加
src/appHtml.js         prototype/index.html の自動生成コピー(npm run sync-html)
src/notifications.js   毎日繰り返しのローカル通知(予定開始+5分前の切り替え予告)
```

Web版(`prototype/index.html`)をブラウザで開けばそのまま動きます。
Expo版は同じ画面に加えて、**予定開始通知と5分前予告**がネイティブで届きます。

## 機能

- 時系列タイムライン(NOW強調・サブ項目・完了チェック・進捗)
- リッチな24時間円グラフ(切り替え表示)
- 達成率(ヘッダー右上)+ マンスリー達成率カレンダー + 連続記録
- できなかった日を許す設計: スキップ(ノーカウント)/ 明日へ持ち越し
- XP・レベル・紙吹雪、集中タイマー(ポモドーロ)
- 瞑想 / 日記&アファメーション / テンプレート3種 / Googleカレンダー(.ics)取り込み

## Expo版の起動(PC)

```bash
npm install
npx expo start --clear
```

iPhone/iPadの **Expo Go** でQRコードを読み取ると実機で動きます。

## 開発ルール

アプリの機能は `prototype/index.html` を編集 → `npm run sync-html` で
`src/appHtml.js` を再生成してコミット。Expo側は自動で同じ画面になります。
