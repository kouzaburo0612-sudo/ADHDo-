// 最小限のService Worker(ホーム画面追加対応 — 仕様書 §1)
// オフラインキャッシュは行わない(常に最新データを表示するため)
self.addEventListener("install", () => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("fetch", () => {
  // パススルー(ネットワーク直行)
});
