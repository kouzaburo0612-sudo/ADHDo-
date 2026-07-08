import React, { useEffect, useRef, useState } from 'react';
import { Platform, SafeAreaView } from 'react-native';
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
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        bounces={false}
        style={{ flex: 1, backgroundColor: BG }}
      />
    </SafeAreaView>
  );
}
