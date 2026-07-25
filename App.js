import React, { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, SafeAreaView } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { ExtensionStorage } from '@bacons/apple-targets';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import APP_HTML from './src/appHtml';
import { rescheduleNotifications, scheduleTestNotification, ensurePermission, setBadgeCount } from './src/notifications';

// アーキテクチャ: Web版(prototype/index.html)をWebViewで表示するシェル。
// - データ: WebView内のlocalStorage + AsyncStorageへミラー(起動時に注入して復元)
// - 通知: WebViewからpostMessageされたスケジュールでネイティブのローカル通知を組む

const BG = '#0d1017';

// ホーム画面ウィジェットとのデータ共有(App Group)。iOSのみ
const APP_GROUP = 'group.com.kozaburookuda.adhdo';
let widgetStorage = null;
try { if (Platform.OS === 'ios') widgetStorage = new ExtensionStorage(APP_GROUP); } catch {}
let widgetReloadTimer = null;

export default function App() {
  const [seedJs, setSeedJs] = useState(null);
  const webviewRef = useRef(null);

  useEffect(() => {
    // 起動時に通知の許可を確認(初回はここでOSのダイアログが出る)
    ensurePermission();

    (async () => {
      try {
        const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('adhdo.'));
        const pairs = keys.length ? await AsyncStorage.multiGet(keys) : [];
        const js = pairs
          .filter(([, v]) => v != null)
          .map(([k, v]) => `try{localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)})}catch(e){}`)
          .join('\n');
        setSeedJs(js + '\ntrue;');
      } catch {
        setSeedJs('true;');
      }
    })();
  }, []);

  const tellWebView = (js) => {
    if (webviewRef.current) webviewRef.current.injectJavaScript(js + ';true;');
  };

  // 共有シート(Share Extension)が App Group に置いたキューをInboxへ取り込む
  const drainShareQueue = async () => {
    if (!widgetStorage) return;
    try {
      const raw = widgetStorage.get('inboxQueue');
      if (!raw) return;
      widgetStorage.remove('inboxQueue');
      const queue = JSON.parse(raw);
      if (!Array.isArray(queue) || !queue.length) return;
      const items = [];
      for (const q of queue) {
        if (q.imagePath) {
          try {
            const b64 = await FileSystem.readAsStringAsync('file://' + q.imagePath, { encoding: 'base64' });
            items.push({ ts: q.ts, image: 'data:image/jpeg;base64,' + b64 });
            FileSystem.deleteAsync('file://' + q.imagePath, { idempotent: true }).catch(() => {});
          } catch {}
        } else {
          items.push({ ts: q.ts, text: q.text, url: q.url });
        }
      }
      if (items.length) {
        tellWebView(`window.__inboxIngest && window.__inboxIngest(${JSON.stringify(JSON.stringify(items))})`);
      }
    } catch {}
  };

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') drainShareQueue();
    });
    return () => sub.remove();
  }, []);

  const onMessage = (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'kv') {
        AsyncStorage.setItem(msg.key, msg.value).catch(() => {});
      } else if (msg.type === 'schedule') {
        rescheduleNotifications(msg.events, msg.notify, msg.notifySubs).then((count) => {
          tellWebView(`window.__notifySet && window.__notifySet(${count})`);
        });
      } else if (msg.type === 'badge') {
        setBadgeCount(msg.count);
      } else if (msg.type === 'openUrl') {
        Linking.openURL(msg.url).catch(() => {});
      } else if (msg.type === 'fetchmeta') {
        // WebView内はCORSで外部サイトを読めないため、ネイティブ側でタイトルを取得して返す
        fetch(msg.url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
          .then((r) => r.text())
          .then((html) => {
            const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
            const title = m ? m[1].trim().slice(0, 120) : null;
            if (title) tellWebView(`window.__inboxMeta && window.__inboxMeta(${JSON.stringify(msg.id)}, ${JSON.stringify(title)})`);
          })
          .catch(() => {});
      } else if (msg.type === 'widget') {
        if (widgetStorage) {
          try { widgetStorage.set('today', JSON.stringify(msg.payload)); } catch {}
          clearTimeout(widgetReloadTimer);
          widgetReloadTimer = setTimeout(() => { try { ExtensionStorage.reloadWidget(); } catch {} }, 1500);
        }
      } else if (msg.type === 'test') {
        scheduleTestNotification().then((ok) => {
          tellWebView(`window.__notifyTest && window.__notifyTest(${ok ? 'true' : 'false'})`);
        });
      }
    } catch {}
  };

  if (seedJs === null) return null; // 保存データの読み込み待ち

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ExpoStatusBar style="light" />
      <WebView
        ref={webviewRef}
        originWhitelist={['*']}
        source={{ html: APP_HTML, baseUrl: 'https://adhdo.app' }}
        injectedJavaScriptBeforeContentLoaded={seedJs}
        onMessage={onMessage}
        onLoadEnd={() => setTimeout(drainShareQueue, 800)}
        keyboardDisplayRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        bounces={false}
        style={{ flex: 1, backgroundColor: BG }}
      />
    </SafeAreaView>
  );
}
