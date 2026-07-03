import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import APP_HTML from './src/appHtml';
import { rescheduleNotifications } from './src/notifications';

// アーキテクチャ: Web版(prototype/index.html)をWebViewで表示するシェル。
// - データ: WebView内のlocalStorage + AsyncStorageへミラー(起動時に注入して復元)
// - 通知: WebViewからpostMessageされたスケジュールでネイティブのローカル通知を組む

const BG = '#0d1017';

export default function App() {
  const [seedJs, setSeedJs] = useState(null);

  useEffect(() => {
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

  const onMessage = (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'kv') {
        AsyncStorage.setItem(msg.key, msg.value).catch(() => {});
      } else if (msg.type === 'schedule') {
        rescheduleNotifications(msg.events, msg.notify);
      }
    } catch {}
  };

  if (seedJs === null) return null; // 保存データの読み込み待ち

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ExpoStatusBar style="light" />
      <WebView
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
