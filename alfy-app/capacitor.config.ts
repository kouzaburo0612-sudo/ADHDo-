import type { CapacitorConfig } from "@capacitor/cli";

// Alfyアプリ(ガワネイティブ)設定。
// server.url に本番WebのURLを指定しているため、Webをデプロイすると
// アプリの中身も即座に同じ状態になる(ストア再審査不要)。
// ドメイン取得後は url を https://alfy.app 等に差し替えて再ビルド・再提出する。
const config: CapacitorConfig = {
  appId: "com.alfy.app", // App Store Connect / Play Console 登録時のIDと一致させること
  appName: "Alfy",
  webDir: "www", // オフライン時フォールバック(通常は server.url が表示される)
  server: {
    url: "https://adh-do-mu.vercel.app",
    cleartext: false,
  },
  backgroundColor: "#1B2B4B",
  ios: {
    contentInset: "automatic",
  },
};

export default config;
