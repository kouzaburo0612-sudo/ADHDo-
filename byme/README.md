# BYME — Life, by me.

**「忘れないために、毎日自分を刷り込む。」**

アファメーション・成功後のイメージング・短期/中期/長期目標・目標数字・成功法則や戒めを一元管理し、
ADHDでも毎日確実に反復・想起・習慣化できる自己刷り込みアプリ(v3)。

新しい目標を提案するアプリではない。すでに自分で決めた重要事項を、
**重複なく整理し、毎日必ず見せ、声に出して唱えさせ、成功後の場面をイメージさせ、長期的に反復させる**ことに特化する。

- Expo SDK 57 / TypeScript strict / expo-router
- 完全ローカル(expo-sqlite)。Phase 1はネットワーク不使用
- 状態管理は Zustand、通知はローカル通知のみ

## 画面構成(v3)

```
TODAY    … 主役。起動時に必ず表示。「今日のBYMEを始める」1タップで儀式へ
MASTER   … 全コンテンツの正本。一覧・検索・追加・編集・並べ替え・アーカイブ・重複整理
HISTORY  … カレンダー・ストリーク・今月実施日数・直近30日実施率・モード内訳
SETTINGS … 儀式モード・自動送り・音声読み上げ・通知4種・曜日・データ入出力
RITUAL   … 全画面没入プレイヤー(タブ非表示)。1画面1メッセージ
```

## 儀式(RITUAL)

順番は固定: **AFFIRMATION → IMAGING → GOALS → NUMBERS → PRINCIPLES → COMPLETE**

| モード | 目安 | 内容 |
|---|---|---|
| QUICK | 60秒 | 最重要アファ1・イメージング1・短中長期目標・最重要数字・最重要原則1 |
| STANDARD | 3分 | アファ〜5・イメージング〜3・目標3階層・主要数字・CORE原則+日替わり1 |
| FULL | 5〜10分 | FULL対象の全項目(設定の最大件数で制限可) |

- プレイリストは登録コンテンツから毎回動的生成(`src/lib/playlist.ts`)。固定15画面は廃止
- ROTATING原則は 重要度/最終表示からの経過/表示回数/新規追加/重点反復 のスコアで日替わり選出。全項目が一定期間内に必ず一巡する
- アファメーションは文単位で1画面1メッセージ表示(設定で全文表示に切替可)
- 進捗は1ステップごとにSQLiteへ保存。**アプリを閉じても同日なら続きから再開**
- 完了時に表示項目をまとめて実施済み記録(項目ごとの「唱えた」ボタンは廃止)
- 同日の重複完了は実施日数に二重計上されない

## NUMBERS の二層構造

正式目標(OFFICIAL TARGET)と唱えるストレッチ数字(IMAGING TARGET)は**別フィールド**で管理し、
儀式でも別画面で表示する。現在値はMASTERで更新。

## データモデル(スキーマv6)

```
content_items    … 全コンテンツ統合(type: AFFIRMATION/IMAGING/GOAL/NUMBER/PRINCIPLE/OPTIONAL)
                   priority / cadence / modes / emphasis / last_shown_at / show_count
                   archived_at(削除ではなくアーカイブ)/ canonical_item_id / duplicate_status
ritual_sessions  … 儀式セッション(date/mode/playlist/current_index/status/resumed)
merge_log        … 統合の履歴(原文保全・復元可能)
settings         … キーバリュー設定
旧テーブル(kpis/principles/affirmations/scenes/quests/daily_log/reads)は原本として残置
```

v6マイグレーション(`src/db/schema.ts` + `src/db/migrateV6Data.ts`):
- BE→AFFIRMATION / THEATER→IMAGING / ロードマップ→GOAL / KPI→NUMBER / MIND→PRINCIPLE(戒め3カ条はCORE)/ クエスト・BODY・睡眠→OPTIONAL
- 文章は原文のまま移行(要約・改変なし)。完全一致は重複「候補」としてマークのみ
- 旧daily_logの完了日はCOMPLETEDセッションとして引き継ぎ(ストリーク・累計保全)
- トランザクション内で実行。旧テーブルは削除しないためロールバック可能

## 重複検出(`src/lib/duplicates.ts`)

正規化(NFKC・句読点/空白除去)→ 完全一致 / 包含 / 文字bigramのJaccard+overlap係数。
閾値以上で「似た内容がすでにあります」→ 統合 / 別項目として残す / 今回は無視 を選択。
統合しても `merge_log` に原文を保全し、アーカイブから復元できる。
`DuplicateDetector` インターフェースで分離してあり、将来LLM APIに差し替え可能(偽AI実装はしない)。

## 通知(`src/lib/notifications.ts`)

| 時刻 | 文言 | 条件 |
|---|---|---|
| 起床時刻 | 自分の人生を思い出す時間です。 | 曜日設定に従う |
| 12:30 | 今日のBYMEは、まだ完了していません。 | 未完了の日だけ |
| 17:30 | 3分あれば、今日の自分に戻れます。 | 未完了の日だけ |
| 21:30 | 60秒のQUICKだけでも、今日をゼロにしない。 | 未完了の日だけ |

昼・夕・夜は7日先までDATEトリガーで組み、完了・設定変更時に組み直す。タップでTODAYへ。

## 開発

```bash
cd byme
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest(playlist/duplicates/stats/sentences/migration)
npx expo start      # 開発サーバー
```

ビルド/TestFlight配信はGitHub Actions(`.github/workflows/byme-eas-build.yml`)経由。

## ディレクトリ

```
src/app/(tabs)/         today / master / history / settings
src/app/ritual.tsx      儀式プレイヤー(全画面・再開対応)
src/app/master/         [type]一覧 / item/[id]エディタ(重複チェック付き)
src/db/                 schema(v6)/ queries / types / migrateV6Data
src/lib/                playlist / duplicates / stats / sentences / notifications / dates
src/store/              useAppStore(Zustand)
src/data/master.ts      マスターコンテンツ(文言の正)
```
