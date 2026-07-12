/** 設定タブ(Moreメニュー内)。本体はSettingsBodyを共用 */
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandHeader } from '@/components/BrandHeader';
import { SettingsBody } from '@/components/SettingsSheet';
import { Colors } from '@/constants/theme';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg, paddingTop: insets.top }}>
      <BrandHeader sub="設定" />
      <SettingsBody />
    </View>
  );
}
