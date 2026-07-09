# Master Health

WithingsとOura RingのデータをApple Health (HealthKit) 経由で一元表示するパーソナル健康ダッシュボード。

- Expo SDK 57 / TypeScript / expo-router (NativeTabs)
- HealthKit: `@kingstinct/react-native-healthkit` (config plugin使用・Expo Go不可)
- グラフ: `victory-native` (Skia描画)
- ローカルDB: `expo-sqlite`
- AIアドバイス: Anthropic API (`claude-sonnet-4-6`)

## 構成

```
src/
  app/            画面 (index=今日 / history=トレンド / coach=AI / settings=設定)
  components/     ScoreRing・TrendChart・共有UI
  constants/theme.ts   デザイントークン(カラー・タイポ・スペーシング)
  hooks/useHealthData.ts  データ取得フック
  lib/            healthkit.ts(取得層) db.ts(SQLite) sync.ts ai.ts settings.ts
  utils/score.ts  総合スコア算出ロジック(根拠コメント付き。調整はここ)
  utils/baseline.ts    異常検知・目標予測・タグ相関
```

## ビルド & TestFlight提出(GitHub Actionsのみで完結)

リポジトリの **Actions** タブから実行する。ローカルMac・Xcodeは不要。

| ワークフロー | 用途 |
|---|---|
| `MH 0. EAS Project Init` | 初回のみ。EASプロジェクトを作成し projectId をコミット |
| `MH 1. EAS Build & TestFlight` | iOS本番ビルド → TestFlight自動提出 |
| `MH 2. EAS Status` | ビルド・提出状況の確認 |

### 必要なGitHub Secrets

| Secret | 内容 |
|---|---|
| `EXPO_TOKEN` | Expoアクセストークン(ADHDoと共用) |
| `MH_ASC_API_KEY` | App Store Connect APIキー(.p8の中身) |
| `MH_ASC_KEY_ID` | 同キーのKey ID |
| `MH_ASC_ISSUER_ID` | 同キーのIssuer ID |
| `MH_ANTHROPIC_API_KEY` | (任意) AIアドバイス用。未設定ならアプリ内で入力 |

Apple Team ID `68995AYXDQ` / Bundle ID `com.nash.masterhealth` はワークフローに設定済み。
法人アカウントの場合はリポジトリ変数 `MH_APPLE_TEAM_TYPE` に `COMPANY_OR_ORGANIZATION` を設定。
