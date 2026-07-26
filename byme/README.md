# BYME — Life, by me.

目標を「見る」アプリではなく「唱える」アプリ。
毎朝3ステップの儀式(宣言 → 心得 → 日記)で、なりたい自分を現在進行形で潜在意識に刷り込む。

- Expo SDK 57 / TypeScript strict / expo-router
- ローカルファースト(expo-sqlite)・状態管理は Zustand
- AI変換(目標→宣言文、なりたい自分→アイデンティティ/MVV)は Supabase Edge Function `byme-ai` 経由で Anthropic API(claude-sonnet-4-6)を呼ぶ。APIキーはクライアントに置かない
- AI未接続でもローカルのルールベース変換でオンボーディングが完結する(全文編集可)

## 構成

```
src/app/                 expo-router 画面
  (onboarding)/          welcome → identity-mvv → goals-input → ai-convert
                         → principles-pick → notification-setup
  (tabs)/                today / vision / mind / log
  declare-mode.tsx       宣言モード(全画面・タップで次へ)
  settings.tsx           通知時刻・宣言文管理・データ書き出し・AI設定
src/db/                  SQLiteスキーマ(PRAGMA user_versionマイグレーション)+クエリ
src/store/               Zustandストア(アプリ状態+通知の再スケジュール)
src/lib/                 dates / streak / ai(+ローカルフォールバック)/ notifications / progate
src/data/presets.ts      心得プリセット(経営者テンプレート約30項目ほか)
supabase/functions/byme-ai/  AI変換 Edge Function(Deno)
plugins/                 aps-environmentエンタイトルメント除去(ローカル通知のみ使用)
```

## TestFlight 配信(GitHub Actionsのみで完結・PC不要)

ワークフローは `main` ブランチ上に置かれ、常に `claude/app-dev-instructions-xpncjc` ブランチのコードをビルドする(Master Healthと同方式)。

初回のみ、Actionsタブから順に実行:

1. **BYME 0. EAS Project Init** — EASプロジェクトを作成し projectId をコミット
2. **BYME 9. KeySetup** — クレデンシャル受け渡し用のブートストラップ鍵を発行(ログに公開鍵が出る)
3. **BYME 3. Supabase AI Function Deploy** — `enc_pat`(暗号化Supabaseトークン)と `enc_anthropic`(暗号化Anthropicキー)を入力して byme-ai をデプロイ
4. **BYME 1. EAS Build & TestFlight** — ビルド&TestFlight自動提出
   - ASCクレデンシャルはEAS保管庫 → GitHub Secrets(MHと共通)→ `enc_creds` 入力の順で解決
   - App Store Connect に「BYME」(bundle: `com.nash.byme`)のアプリレコードが無い場合はビルドのみ実行される。App Store Connect(iPhoneのブラウザでも可)でアプリを作成してから再実行すると提出まで自動化される

2回目以降は **BYME 1** を実行するだけ。状況確認は **BYME 2. EAS Status**。

## Phase 1 動作確認手順

1. TestFlightからインストール → 初回起動でオンボーディングが始まる
2. welcome 3枚 → なりたい自分を入力 → AI生成(オフライン時は自動変換)→ 編集して確定
3. 目標を2〜3件入力 → 宣言文への変換結果を編集して確定 → 心得テンプレート選択(経営者)→ 通知時刻を設定して完了
4. TODAYタブ: 最上部にアイデンティティ宣言文(タップで編集)。「DECLARE」で宣言モードへ → 全件唱えて完了 → BEに✓
5. 「胸に刻んだ」で心得✓ → 日記3行を保存 → 「TODAY COMPLETE」表示+ストリークが1に
6. VISIONタブ: MVV3カード編集、目標のアコーディオン(残日数表示)、「宣言に」で宣言文追加
7. MINDタブ: 心得の追加/編集/オンオフ。LOGタブ: ヒートマップと日記履歴
8. 翌朝、設定時刻に宣言文が通知で届く。21時に日記未記入ならリマインド

## 開発(PC/Mac がある場合のみ)

```bash
npm install
npx expo start
```

型検査: `npx tsc --noEmit`

## フェーズ

- **Phase 1(このリポジトリの現状)**: タブ4画面+宣言モード+SQLite+ストリーク+ローカル通知+オンボーディング(AI変換)+経営者プリセット+TestFlight配信
- **Phase 2**: Supabase同期・音声録音再生・ウィジェット・ダークモード
- **Phase 3**: RevenueCat課金(ProGateは実装済みの抽象化を有効化)・月次AIレビュー・ストリーク保護
