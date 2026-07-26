# Alfy — 日程調整を、スマートに。

AI秘書「Alfyくん」が日程調整をお手伝いするWebアプリ(MVP v1.0)。

- 回答者は**登録・アプリ不要**。URLを開いて○△×で回答するだけ。
- データは**確定・締切から30日で自動削除**。
- 運営は内容を閲覧しません(個人名・回答内容はログにも出力しません)。

## 技術スタック

| 役割 | 技術 |
|---|---|
| フロント / API | Next.js 14 (App Router, TypeScript) — Vercelにデプロイ |
| DB | Supabase (PostgreSQL, RLS有効・service role経由のみ) |
| AI | Anthropic API (`claude-sonnet-4-6`) — 候補生成・自動回答 |
| メール | Resend — 確定通知・リマインド |
| カレンダー | サーバー側で .ics 生成・配布 |
| PWA | manifest + Service Worker(ホーム画面追加対応) |

## セットアップ手順(運用引き継ぎ用)

### 1. Supabase

1. https://supabase.com でプロジェクトを作成
2. SQL Editor で `supabase/schema.sql` の内容を貼り付けて実行
3. Project Settings → API から以下を控える
   - `Project URL` → 環境変数 `SUPABASE_URL`
   - `service_role` キー → 環境変数 `SUPABASE_SERVICE_ROLE_KEY`(**絶対に公開しない**)

### 2. Anthropic API

1. https://console.anthropic.com でAPIキーを作成
2. → 環境変数 `ANTHROPIC_API_KEY`

### 3. Resend

1. https://resend.com でAPIキーを作成 → 環境変数 `RESEND_API_KEY`
2. 独自ドメイン(alfy.app 等)を取得したら Resend にドメイン登録し、
   環境変数 `RESEND_FROM` を `Alfy <noreply@alfy.app>` のように設定
   (未設定時は Resend のテスト差出人を使用)

### 4. Vercel

1. このリポジトリの `alfy/` をルートとしてプロジェクトを作成(Root Directory: `alfy`)
2. 環境変数を設定(下表)
3. デプロイ後、発行されたURLを `NEXT_PUBLIC_APP_URL` に設定して再デプロイ
4. 独自ドメイン(alfy.app / alfy.jp)取得後は Vercel の Domains から接続し、
   `NEXT_PUBLIC_APP_URL` を差し替える

### 環境変数一覧

```
ANTHROPIC_API_KEY=        # Anthropic APIキー
SUPABASE_URL=             # SupabaseのProject URL
SUPABASE_SERVICE_ROLE_KEY=# Supabaseのservice roleキー(秘匿)
RESEND_API_KEY=           # ResendのAPIキー
RESEND_FROM=              # 差出人(任意。例: Alfy <noreply@alfy.app>)
NEXT_PUBLIC_APP_URL=      # 公開URL(例: https://alfy.app)
CRON_SECRET=              # Cron認証用ランダム文字列(Vercelが自動でヘッダに付与)
```

### Cron(Vercel)

`vercel.json` で設定済み。Vercelは `CRON_SECRET` を `Authorization: Bearer` ヘッダとして自動送信します。

| パス | スケジュール(UTC) | 内容 |
|---|---|---|
| `/api/cron/cleanup` | 毎日 18:00(JST 3:00) | `delete_at` 超過イベントの削除(関連データはcascade削除) |
| `/api/cron/remind` | 毎日 0:00(JST 9:00) | 締切が翌日のイベントの未回答リマインドメール |

※ リマインドはメールアドレス登録済みの回答者のうち未回答候補が残る人に送ります。
メール未登録の未回答者には連絡先がないため送れません — 管理ページの「LINE催促文面をコピー」で対応してください。

### ブランドアセット

依頼者支給のロゴ・Alfyくん画像・PWAアイコンを `public/brand/` に配置してください(`public/brand/README.md` 参照)。

## 開発

```bash
cd alfy
npm install
cp .env.example .env.local  # 値を記入
npm run dev
```

- 型チェック: `npm run typecheck`
- E2Eテスト(外部APIモック・主要フロー): `npx playwright install chromium` 後 `npm run test:e2e`

## 画面フロー

```
/                     ホーム(つくる / 回答する)
/new                  作成STEP1(イベント名・所要時間・候補数・締切・期間・時間帯)
/new/google           Googleカレンダー連携(v1は準備中表示のみ)
/new/availability     作成STEP2(空き時間の自由文・音声・写真 → AI候補生成 → 確認 → 保存)
/e/[code]/share       共有(回答URL・LINEで送る・管理ページへ)
/e/[code]             回答(登録不要・○△×・代理回答・AI自動回答・任意メール)
/e/[code]/admin?token 管理(マトリクス・全員○・確定・LINE催促文面)
確定後 /e/[code]       「決まりました。」+ .ics + LINE確定文面
```

## セキュリティ / プライバシー方針(仕様書 §6)

- 匿名アクセスはAPIルート(サーバー側・service role)経由のみ。全テーブルRLS有効・ポリシーなし(anonからは全拒否)。
- 回答ページは `code`、管理ページは `code + admin_token` で認可。
- `delete_at` による30日自動削除(確定時は確定日+30日に更新)。
- 個人名・回答内容をサーバーログに出力しない。
- AI利用は `ai_usage` に種別のみ記録(内容は保存しない)。

## v1でやらないこと(仕様書 §4, §7)

- 課金・広告・分析機能
- LINE通知・アプリプッシュ(v1.5予定。LINEへの展開はコピー用文面生成で代替)
- Googleカレンダー連携のOAuth実装(v1.5予定。free/busyのみ取得予定)
- ネイティブアプリ化(Capacitor)

---
作成: 2026-07-26 / 依頼者: 奥田(Alfy開発オーナー) / 仕様書: Alfy開発仕様書 v1.0
