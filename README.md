# ADHDo

ADHDのための1日タイムスケジュール管理アプリ(Expo / React Native)。

## 機能

- **ホーム** — 上から下へ時系列のタイムライン。現在の時間帯(NOW)をその場で拡大・カテゴリ色で強調し、進捗バーと残り時間を表示。サブ項目には開始–終了時間つき。24時間円グラフ(カテゴリ色セグメント・アイコン・現在時刻の針・タップで該当カードへジャンプ)
- **瞑想** — 呼吸ガイド(4-4-8)つきタイマー
- **日記** — その日のふりかえりを保存(端末内に永続化)
- **アファメーション** — 自分に優しい言葉+カスタム追加
- **プロフィール & 設定**

カテゴリ色: 筋トレ=赤 / Work=青 / 食事=オレンジ / 睡眠=紫 / ルーティン=緑

## 起動方法(PC)

```bash
git clone https://github.com/kouzaburo0612-sudo/ADHDo-.git
cd ADHDo-
npm install
npx expo start --clear
```

表示されたQRコードをiPhoneの **Expo Go** アプリで読み取ると実機で動きます。

## 構成

```
App.js                  ルート(タブ切り替え)
src/data.js             スケジュールデータとカテゴリ定義 ← 予定を編集するのはここ
src/theme.js            カラートークン
src/components/         24h円グラフ・フッターナビ
src/screens/            各タブの画面
prototype/index.html    最初のHTMLプロトタイプ(参考用)
```
