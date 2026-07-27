# Alfy モバイルアプリ(Capacitor ガワネイティブ)

本番Web(`https://adh-do-mu.vercel.app`)をそのまま表示するネイティブアプリの殻です。

**重要な性質: Webをデプロイすると、ストア再審査なしでアプリの中身も即座に同じ状態になります。**
アプリバイナリの再ビルド・再提出が必要なのは以下のときだけ:

- 表示するURLの変更(独自ドメイン取得時 → `capacitor.config.ts` の `server.url` を変更)
- アイコン・スプラッシュ・アプリ名の変更
- プッシュ通知などネイティブ機能の追加

## 構成

```
alfy-app/
  capacitor.config.ts   # appId: com.kozaburo.alfy / server.url: 本番WebのURL
  www/                  # オフライン時のフォールバック画面のみ
  ios/                  # Xcodeプロジェクト(生成済み)
  android/              # Android Studio(Gradle)プロジェクト(生成済み)
```

## iOSのビルドと提出(Macが必要)

```bash
cd alfy-app
npm install
npx cap sync
npx cap open ios   # Xcodeが開く
```

Xcodeで:
1. TARGETS「App」→ Signing & Capabilities → Team に自分のApple Developerチームを選択
2. Bundle Identifier が `com.kozaburo.alfy` であること(App Store Connect側でも同じIDでアプリを作成)
3. 実機テスト: 上部のデバイス選択で自分のiPhone → ▶
4. 提出: Product → Archive → Distribute App → App Store Connect

## Androidのビルドと提出

```bash
npx cap open android   # Android Studioが開く
```

Android Studioで Build → Generate Signed Bundle(.aab)→ Play Consoleへアップロード。

## ストア審査の注意(Apple ガイドライン4.2)

「Webを表示するだけのアプリ」はAppleに却下されることがあります。
提出前に**プッシュ通知(確定通知・リマインド)を追加する**ことを推奨します(v1.5計画)。
実装する場合は `@capacitor/push-notifications` + サーバー側の送信処理を追加します — 開発担当(Claude)に「プッシュ通知を実装して」と依頼してください。

## アイコン

現在はCapacitorのデフォルトアイコンです。ブランドアイコン(1024×1024 PNG)が用意できたら
`npx @capacitor/assets generate` で全サイズを自動生成できます。
