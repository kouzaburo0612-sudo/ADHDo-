import React, { useState } from 'react';
import { SafeAreaView, View, StatusBar } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { T } from './src/theme';
import Footer from './src/components/Footer';
import HomeScreen from './src/screens/HomeScreen';
import MeditateScreen from './src/screens/MeditateScreen';
import DiaryScreen from './src/screens/DiaryScreen';
import AffirmScreen from './src/screens/AffirmScreen';
import ProfileScreen from './src/screens/ProfileScreen';

export default function App() {
  const [tab, setTab] = useState('home');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg, paddingTop: StatusBar.currentHeight || 0 }}>
      <ExpoStatusBar style="light" />
      <View style={{ flex: 1 }}>
        {tab === 'home' && <HomeScreen />}
        {tab === 'meditate' && <MeditateScreen />}
        {tab === 'diary' && <DiaryScreen />}
        {tab === 'affirm' && <AffirmScreen />}
        {tab === 'profile' && <ProfileScreen />}
      </View>
      <Footer tab={tab} setTab={setTab} />
    </SafeAreaView>
  );
}
