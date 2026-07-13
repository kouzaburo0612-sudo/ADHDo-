/**
 * 報告: 食事(写真AI分析・バーコード・手入力)・運動(HealthKit自動 + 手動)・ストレスの3種。
 */
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { AppHeader } from '@/components/AppHeader';
import { Card, Chip, SectionTitle } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { adviceErrorMessage } from '@/lib/ai';
import { lookupBarcode, type BarcodeProduct } from '@/lib/barcode';
import { getDay } from '@/lib/db';
import { todayKey } from '@/lib/dates';
import { formatValue } from '@/lib/metrics';
import { rescheduleReminders } from '@/lib/notifications';
import {
  addMealLog, addStressLog, addWorkoutLog, dailyIntake, deleteMealLog, deleteStressLog,
  deleteTemplate, deleteWorkoutLog, deleteWorkoutTemplate, listMealLogs, listStressLogs,
  listTemplates, listWorkoutLogs, listWorkoutTemplates, localDateKey, newId,
  templateNutrition, upsertIngredient, upsertTemplate, upsertWorkoutTemplate,
  type ExerciseSet, type FoodTemplate, type MealLog, type StressLog, type WorkoutLog,
  type WorkoutTemplate,
} from '@/lib/store';
import { estimateFoodFromPhoto, type FoodEstimate } from '@/lib/vision';

type Tab = 'meal' | 'workout' | 'stress';

const STRESS_LEVELS = [
  { level: 1, emoji: '😌', label: '快調' },
  { level: 2, emoji: '🙂', label: 'ふつう' },
  { level: 3, emoji: '😥', label: 'やや疲れ' },
  { level: 4, emoji: '😰', label: 'つらい' },
  { level: 5, emoji: '🤯', label: '限界' },
];

const CARDIO_PRESETS = ['ウォーキング', 'ランニング', 'サイクリング', '水泳', 'ヨガ', 'サウナ'];

export default function ReportScreen() {
  const [tab, setTab] = useState<Tab>('meal');

  return (
    <View style={styles.root}>
    <AppHeader sub="実績報告" />
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: Spacing.md, paddingBottom: 120 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* 大きく目立つ切り替えタブ(食事/運動/ストレス) */}
      <View style={styles.bigTabs}>
        {([
          { value: 'meal' as const, emoji: '🍚', label: '食事' },
          { value: 'workout' as const, emoji: '💪', label: '運動' },
          { value: 'stress' as const, emoji: '🧠', label: 'ストレス' },
        ]).map((t) => (
          <Pressable
            key={t.value}
            style={[styles.bigTab, tab === t.value && styles.bigTabActive]}
            onPress={() => setTab(t.value)}
          >
            <Text style={styles.bigTabEmoji}>{t.emoji}</Text>
            <Text style={[styles.bigTabLabel, tab === t.value && styles.bigTabLabelActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      {tab === 'meal' && <MealSection />}
      {tab === 'workout' && <WorkoutSection />}
      {tab === 'stress' && <StressSection />}
    </ScrollView>
    </View>
  );
}

// ============================== 食事 ==============================

function MealSection() {
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [totals, setTotals] = useState({ kcal: 0, protein: 0, fat: 0, carbs: 0 });
  const [analyzing, setAnalyzing] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<FoodEstimate | null>(null);
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  // バーコード
  const [scanOpen, setScanOpen] = useState(false);
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [product, setProduct] = useState<BarcodeProduct | null>(null);
  const [grams, setGrams] = useState('100');
  const scannedRef = useRef(false);

  const [templates, setTemplates] = useState<{ t: FoodTemplate; kcal: number }[]>([]);

  const load = useCallback(async () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const list = await listMealLogs(start.toISOString(), end.toISOString());
    setMeals(list);
    const t = (await dailyIntake(start.toISOString(), end.toISOString()))
      .get(localDateKey(now.toISOString())) ?? { kcal: 0, protein: 0, fat: 0, carbs: 0 };
    setTotals({
      kcal: Math.round(t.kcal), protein: Math.round(t.protein),
      fat: Math.round(t.fat), carbs: Math.round(t.carbs),
    });
    const tpls = await listTemplates();
    setTemplates(await Promise.all(tpls.map(async (tp) => ({ t: tp, kcal: (await templateNutrition(tp)).kcal }))));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pick = async (fromCamera: boolean) => {
    const fn = fromCamera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { Alert.alert('カメラの許可が必要です'); return; }
    }
    const result = await fn({
      mediaTypes: ['images'],
      quality: 0.4,
      base64: true,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    const asset = result.assets[0];
    setPhotoUri(asset.uri);
    setEstimate(null);
    setAnalyzing(true);
    try {
      const est = await estimateFoodFromPhoto(asset.base64!, asset.mimeType ?? 'image/jpeg');
      setEstimate(est);
    } catch (e) {
      Alert.alert('分析できませんでした', adviceErrorMessage(e));
      setPhotoUri(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const recordEstimate = async () => {
    if (!estimate) return;
    await addMealLog({
      id: newId(), timestamp: new Date().toISOString(),
      freeText: estimate.name,
      kcal: estimate.kcal, protein: estimate.protein, fat: estimate.fat, carbs: estimate.carbs,
      isEstimate: true,
    });
    setEstimate(null);
    setPhotoUri(null);
    rescheduleReminders().catch(() => {});
    load();
  };

  const openScanner = async () => {
    if (!camPerm?.granted) {
      const p = await requestCamPerm();
      if (!p.granted) { Alert.alert('カメラの許可が必要です'); return; }
    }
    scannedRef.current = false;
    setProduct(null);
    setScanOpen(true);
  };

  const onBarcode = async (code: string) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setScanOpen(false);
    setAnalyzing(true);
    try {
      const p = await lookupBarcode(code);
      setProduct(p);
      setGrams(String(p.servingG ?? 100));
    } catch (e) {
      const msg = e instanceof Error && e.message === 'NOT_FOUND'
        ? 'この商品はデータベースに見つかりませんでした。写真AIか手入力をお試しください'
        : '読み取りに失敗しました。通信環境を確認してください';
      Alert.alert('バーコード', msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const recordProduct = async () => {
    if (!product) return;
    const g = parseFloat(grams) || 100;
    const k = g / 100;
    await addMealLog({
      id: newId(), timestamp: new Date().toISOString(),
      freeText: `${product.name} ${Math.round(g)}g`,
      kcal: Math.round(product.kcal100 * k),
      protein: Math.round(product.protein100 * k * 10) / 10,
      fat: Math.round(product.fat100 * k * 10) / 10,
      carbs: Math.round(product.carbs100 * k * 10) / 10,
      isEstimate: false,
    });
    setProduct(null);
    rescheduleReminders().catch(() => {});
    load();
  };

  const recordManual = async () => {
    const k = parseFloat(kcal);
    if (!name.trim() || !Number.isFinite(k)) {
      Alert.alert('入力エラー', '名前とカロリーは必須です');
      return;
    }
    await addMealLog({
      id: newId(), timestamp: new Date().toISOString(),
      freeText: name.trim(),
      kcal: k,
      protein: parseFloat(protein) || 0,
      fat: parseFloat(fat) || 0,
      carbs: parseFloat(carbs) || 0,
      isEstimate: false,
    });
    setName(''); setKcal(''); setProtein(''); setFat(''); setCarbs('');
    rescheduleReminders().catch(() => {});
    load();
  };

  /** 手入力フォームの内容を食事テンプレートとして保存(上限30件) */
  const saveAsTemplate = async () => {
    const k = parseFloat(kcal);
    if (!name.trim() || !Number.isFinite(k)) {
      Alert.alert('入力エラー', 'テンプレ保存には名前とカロリーが必要です');
      return;
    }
    try {
      const ingId = newId();
      await upsertIngredient({
        id: ingId, name: name.trim(), unit: '食',
        kcalPerUnit: k,
        proteinPerUnit: parseFloat(protein) || 0,
        fatPerUnit: parseFloat(fat) || 0,
        carbsPerUnit: parseFloat(carbs) || 0,
        dietaryTags: [],
      });
      await upsertTemplate({ id: newId(), name: name.trim(), aliases: [], items: [{ ingredientId: ingId, quantity: 1 }] });
      Alert.alert('保存しました', `テンプレート「${name.trim()}」を登録しました。ワンタップやチャットの「${name.trim()}」で記録できます。`);
      load();
    } catch (e) {
      if (e instanceof Error && e.message === 'TEMPLATE_LIMIT') {
        Alert.alert('上限に達しています', '食事テンプレートは30件までです。長押しで不要なものを削除してください。');
      } else {
        Alert.alert('保存に失敗しました');
      }
    }
  };

  const recordTemplate = async (item: { t: FoodTemplate; kcal: number }) => {
    const n = await templateNutrition(item.t);
    await addMealLog({
      id: newId(), timestamp: new Date().toISOString(),
      templateId: item.t.id, freeText: item.t.name,
      kcal: n.kcal, protein: n.protein, fat: n.fat, carbs: n.carbs,
      isEstimate: false,
    });
    rescheduleReminders().catch(() => {});
    load();
  };

  const confirmDeleteTemplate = (item: { t: FoodTemplate; kcal: number }) => {
    Alert.alert('テンプレートを削除', `「${item.t.name}」を削除しますか?`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: async () => { await deleteTemplate(item.t.id); load(); } },
    ]);
  };

  const confirmDelete = (id: string) => {
    Alert.alert('削除', 'この記録を削除しますか?', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: async () => { await deleteMealLog(id); load(); } },
    ]);
  };

  return (
    <>
      <Card style={styles.totalCard}>
        <Text style={styles.totalKcal}>
          {totals.kcal.toLocaleString()}<Text style={styles.totalUnit}> kcal</Text>
        </Text>
        <Text style={styles.totalPfc}>P {totals.protein}g ・ F {totals.fat}g ・ C {totals.carbs}g</Text>
      </Card>

      {templates.length > 0 && (
        <>
          <SectionTitle>マイテンプレート(タップで記録)</SectionTitle>
          <View style={styles.tplWrap}>
            {templates.map((item) => (
              <Pressable
                key={item.t.id}
                style={styles.tplChip}
                onPress={() => recordTemplate(item)}
                onLongPress={() => confirmDeleteTemplate(item)}
              >
                <Text style={styles.tplName}>{item.t.name}</Text>
                <Text style={styles.tplKcal}>{item.kcal}kcal</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.hint}>長押しで削除 ・ {templates.length}/30件</Text>
        </>
      )}

      <SectionTitle>かんたん記録</SectionTitle>
      <View style={styles.photoRow}>
        <Pressable style={styles.photoBtn} onPress={() => pick(true)} disabled={analyzing}>
          <Text style={styles.photoBtnIcon}>📷</Text>
          <Text style={styles.photoBtnText}>撮影する</Text>
        </Pressable>
        <Pressable style={styles.photoBtn} onPress={() => pick(false)} disabled={analyzing}>
          <Text style={styles.photoBtnIcon}>🖼</Text>
          <Text style={styles.photoBtnText}>写真を選ぶ</Text>
        </Pressable>
        <Pressable style={styles.photoBtn} onPress={openScanner} disabled={analyzing}>
          <Text style={styles.photoBtnIcon}>🏷</Text>
          <Text style={styles.photoBtnText}>バーコード</Text>
        </Pressable>
      </View>

      {analyzing && !photoUri && (
        <View style={styles.analyzing}>
          <ActivityIndicator color={Colors.accent} />
          <Text style={styles.analyzingText}>商品を検索中…</Text>
        </View>
      )}

      {product && (
        <Card style={{ marginTop: Spacing.sm }}>
          <Text style={styles.estName}>{product.name}</Text>
          <Text style={styles.totalPfc}>
            100gあたり {product.kcal100}kcal ・ P{product.protein100} F{product.fat100} C{product.carbs100}
          </Text>
          <View style={styles.inputGrid}>
            <NumInput label="食べた量 (g)" value={grams} onChange={setGrams} />
            <View style={{ flex: 1, justifyContent: 'flex-end' }}>
              <Text style={styles.estKcal}>
                {Math.round(product.kcal100 * ((parseFloat(grams) || 100) / 100)).toLocaleString()}
                <Text style={styles.totalUnit}> kcal</Text>
              </Text>
            </View>
          </View>
          <View style={styles.btnRow}>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => setProduct(null)}>
              <Text style={styles.btnGhostText}>やめる</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={recordProduct}>
              <Text style={styles.btnPrimaryText}>この内容で記録</Text>
            </Pressable>
          </View>
        </Card>
      )}

      {/* バーコードスキャナ */}
      <Modal visible={scanOpen} animationType="slide" onRequestClose={() => setScanOpen(false)}>
        <View style={styles.scanRoot}>
          <CameraView
            style={styles.scanCamera}
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
            onBarcodeScanned={(r) => { if (r.data) onBarcode(r.data); }}
          />
          <View style={styles.scanOverlay}>
            <Text style={styles.scanHint}>パッケージのバーコードを枠内に</Text>
            <View style={styles.scanFrame} />
            <Pressable style={styles.scanClose} onPress={() => setScanOpen(false)}>
              <Text style={styles.scanCloseText}>閉じる</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {photoUri && (
        <Card style={{ marginTop: Spacing.sm }}>
          <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" />
          {analyzing && (
            <View style={styles.analyzing}>
              <ActivityIndicator color={Colors.accent} />
              <Text style={styles.analyzingText}>AIが分析中…</Text>
            </View>
          )}
          {estimate && (
            <>
              <Text style={styles.estName}>{estimate.name}</Text>
              <Text style={styles.estKcal}>
                {estimate.kcal.toLocaleString()}<Text style={styles.totalUnit}> kcal</Text>
              </Text>
              <Text style={styles.totalPfc}>
                P {estimate.protein}g ・ F {estimate.fat}g ・ C {estimate.carbs}g
                {estimate.note ? `(${estimate.note})` : ''}
              </Text>
              <View style={styles.btnRow}>
                <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => { setEstimate(null); setPhotoUri(null); }}>
                  <Text style={styles.btnGhostText}>やり直す</Text>
                </Pressable>
                <Pressable style={[styles.btn, styles.btnPrimary]} onPress={recordEstimate}>
                  <Text style={styles.btnPrimaryText}>この内容で記録</Text>
                </Pressable>
              </View>
            </>
          )}
        </Card>
      )}

      <SectionTitle>手入力で記録</SectionTitle>
      <Card>
        <TextInput
          style={styles.input}
          value={name} onChangeText={setName}
          placeholder="料理名(例: 牛丼 並盛)"
          placeholderTextColor={Colors.textFaint}
        />
        <View style={styles.inputGrid}>
          <NumInput label="kcal" value={kcal} onChange={setKcal} />
          <NumInput label="P (g)" value={protein} onChange={setProtein} />
          <NumInput label="F (g)" value={fat} onChange={setFat} />
          <NumInput label="C (g)" value={carbs} onChange={setCarbs} />
        </View>
        <View style={styles.btnRow}>
          <Pressable style={[styles.btn, styles.btnGhost]} onPress={saveAsTemplate}>
            <Text style={styles.btnGhostText}>テンプレに保存</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnPrimary]} onPress={recordManual}>
            <Text style={styles.btnPrimaryText}>記録する</Text>
          </Pressable>
        </View>
      </Card>

      <SectionTitle>今日の食事</SectionTitle>
      {meals.length === 0 ? (
        <Card><Text style={styles.muted}>まだ記録がありません</Text></Card>
      ) : meals.map((m) => (
        <Pressable key={m.id} onLongPress={() => confirmDelete(m.id)}>
          <Card style={styles.mealRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.mealName}>
                {m.freeText ?? 'テンプレート食'}{m.isEstimate ? <Text style={styles.est}> AI概算</Text> : null}
              </Text>
              <Text style={styles.mealTime}>{fmtTime(m.timestamp)} ・ P{Math.round(m.protein)} F{Math.round(m.fat)} C{Math.round(m.carbs)}</Text>
            </View>
            <Text style={styles.mealKcal}>{Math.round(m.kcal)}</Text>
          </Card>
        </Pressable>
      ))}
      {meals.length > 0 && <Text style={styles.hint}>長押しで削除できます</Text>}
    </>
  );
}

// ============================== 運動 ==============================

interface StrengthRow { name: string; weight: string; unit: 'kg' | 'lb'; reps: string; sets: string }
const EMPTY_ROW: StrengthRow = { name: '', weight: '', unit: 'kg', reps: '', sets: '' };

function WorkoutSection() {
  const [auto, setAuto] = useState<{ steps?: number; distance?: number; exercise_time?: number; active_energy?: number }>({});
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);
  const [wTemplates, setWTemplates] = useState<WorkoutTemplate[]>([]);
  const [cardio, setCardio] = useState<string | null>(null);
  const [cardioMin, setCardioMin] = useState('');
  const [rows, setRows] = useState<StrengthRow[]>([{ ...EMPTY_ROW }]);

  const load = useCallback(async () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    setWorkouts(await listWorkoutLogs(start.toISOString(), dayEnd.toISOString()));
    setWTemplates(await listWorkoutTemplates());
    const day = await getDay(todayKey());
    setAuto({
      steps: day.steps, distance: day.distance,
      exercise_time: day.exercise_time, active_energy: day.active_energy,
    });
  }, []);

  const recordWTemplate = async (t: WorkoutTemplate) => {
    await addWorkoutLog({
      id: newId(), timestamp: new Date().toISOString(),
      exercises: t.exercises, durationMin: t.durationMin ?? null, note: t.name,
    });
    load();
  };

  const confirmDeleteWTemplate = (t: WorkoutTemplate) => {
    Alert.alert('テンプレートを削除', `「${t.name}」を削除しますか?`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: async () => { await deleteWorkoutTemplate(t.id); load(); } },
    ]);
  };

  /** 現在の筋トレ入力行をテンプレートとして保存(上限30件) */
  const saveRowsAsTemplate = () => {
    const exercises: ExerciseSet[] = [];
    for (const r of rows) {
      if (!r.name.trim()) continue;
      const reps = parseInt(r.reps, 10);
      const sets = parseInt(r.sets, 10);
      if (!Number.isFinite(reps) || !Number.isFinite(sets)) continue;
      const weight = parseFloat(r.weight);
      exercises.push({
        exerciseName: r.name.trim(),
        weight: Number.isFinite(weight) ? weight : undefined,
        weightUnit: Number.isFinite(weight) ? r.unit : undefined,
        reps, sets,
      });
    }
    if (exercises.length === 0) {
      Alert.alert('入力エラー', '先に種目・回数・セット数を入力してください');
      return;
    }
    Alert.prompt('テンプレート名', '例: 胸の日、いつものメニュー', async (tplName) => {
      if (!tplName?.trim()) return;
      try {
        await upsertWorkoutTemplate({ id: newId(), name: tplName.trim(), exercises, durationMin: null });
        Alert.alert('保存しました', `「${tplName.trim()}」をワンタップやチャットで記録できます。`);
        load();
      } catch (e) {
        if (e instanceof Error && e.message === 'TEMPLATE_LIMIT') {
          Alert.alert('上限に達しています', '運動テンプレートは30件までです。長押しで不要なものを削除してください。');
        } else {
          Alert.alert('保存に失敗しました');
        }
      }
    });
  };

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const recordCardio = async () => {
    if (!cardio) { Alert.alert('種目を選んでください'); return; }
    const min = parseFloat(cardioMin);
    await addWorkoutLog({
      id: newId(), timestamp: new Date().toISOString(),
      exercises: [{ exerciseName: cardio, reps: 1, sets: 1 }],
      durationMin: Number.isFinite(min) ? min : null,
      note: null,
    });
    setCardio(null); setCardioMin('');
    load();
  };

  const recordStrength = async () => {
    const exercises: ExerciseSet[] = [];
    for (const r of rows) {
      if (!r.name.trim()) continue;
      const reps = parseInt(r.reps, 10);
      const sets = parseInt(r.sets, 10);
      if (!Number.isFinite(reps) || !Number.isFinite(sets)) continue;
      const weight = parseFloat(r.weight);
      exercises.push({
        exerciseName: r.name.trim(),
        weight: Number.isFinite(weight) ? weight : undefined,
        weightUnit: Number.isFinite(weight) ? r.unit : undefined,
        reps, sets,
      });
    }
    if (exercises.length === 0) {
      Alert.alert('入力エラー', '種目名・回数・セット数を入れてください');
      return;
    }
    await addWorkoutLog({
      id: newId(), timestamp: new Date().toISOString(),
      exercises, durationMin: null, note: null,
    });
    setRows([{ ...EMPTY_ROW }]);
    load();
  };

  const confirmDelete = (id: string) => {
    Alert.alert('削除', 'この記録を削除しますか?', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: async () => { await deleteWorkoutLog(id); load(); } },
    ]);
  };

  const updateRow = (i: number, patch: Partial<StrengthRow>) => {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };

  return (
    <>
      <SectionTitle>今日の活動(ヘルスケア連携・自動)</SectionTitle>
      <Card>
        <View style={styles.autoRow}>
          <AutoStat label="歩数" value={auto.steps != null ? formatValue('steps', auto.steps) : '–'} unit="歩" />
          <AutoStat label="距離" value={auto.distance != null ? formatValue('distance', auto.distance) : '–'} unit="km" />
          <AutoStat label="運動時間" value={auto.exercise_time != null ? formatValue('exercise_time', auto.exercise_time) : '–'} unit="" />
          <AutoStat label="消費" value={auto.active_energy != null ? formatValue('active_energy', auto.active_energy) : '–'} unit="kcal" />
        </View>
        <Text style={styles.hintLeft}>歩数・消費カロリーは記録不要。自動で収支に反映されます</Text>
      </Card>

      {wTemplates.length > 0 && (
        <>
          <SectionTitle>マイテンプレート(タップで記録)</SectionTitle>
          <View style={styles.tplWrap}>
            {wTemplates.map((t) => (
              <Pressable
                key={t.id}
                style={styles.tplChip}
                onPress={() => recordWTemplate(t)}
                onLongPress={() => confirmDeleteWTemplate(t)}
              >
                <Text style={styles.tplName}>{t.name}</Text>
                <Text style={styles.tplKcal}>{t.exercises.length}種目</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.hint}>長押しで削除 ・ {wTemplates.length}/30件</Text>
        </>
      )}

      <SectionTitle>有酸素・その他を記録</SectionTitle>
      <Card>
        <View style={styles.chipWrap}>
          {CARDIO_PRESETS.map((c) => (
            <Chip key={c} label={c} active={cardio === c} onPress={() => setCardio(cardio === c ? null : c)} />
          ))}
        </View>
        <View style={[styles.inputGrid, { marginTop: Spacing.md }]}>
          <NumInput label="時間(分)" value={cardioMin} onChange={setCardioMin} />
          <View style={{ flex: 2, justifyContent: 'flex-end' }}>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={recordCardio}>
              <Text style={styles.btnPrimaryText}>記録する</Text>
            </Pressable>
          </View>
        </View>
      </Card>

      <SectionTitle>筋トレを記録</SectionTitle>
      <Card>
        {rows.map((r, i) => (
          <View key={i} style={[i > 0 && { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border }]}>
            <TextInput
              style={styles.input}
              value={r.name}
              onChangeText={(v) => updateRow(i, { name: v })}
              placeholder="種目名(例: ベンチプレス)"
              placeholderTextColor={Colors.textFaint}
            />
            <View style={styles.inputGrid}>
              <NumInput label="重量" value={r.weight} onChange={(v) => updateRow(i, { weight: v })} />
              <View style={styles.numWrap}>
                <Text style={styles.numLabel}>単位</Text>
                <Pressable
                  style={styles.unitBtn}
                  onPress={() => updateRow(i, { unit: r.unit === 'kg' ? 'lb' : 'kg' })}
                >
                  <Text style={styles.unitBtnText}>{r.unit}</Text>
                </Pressable>
              </View>
              <NumInput label="回数" value={r.reps} onChange={(v) => updateRow(i, { reps: v })} />
              <NumInput label="セット" value={r.sets} onChange={(v) => updateRow(i, { sets: v })} />
            </View>
          </View>
        ))}
        <View style={styles.btnRow}>
          <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => setRows((p) => [...p, { ...EMPTY_ROW }])}>
            <Text style={styles.btnGhostText}>+ 種目を追加</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnPrimary]} onPress={recordStrength}>
            <Text style={styles.btnPrimaryText}>記録する</Text>
          </Pressable>
        </View>
        <Pressable style={[styles.btn, styles.btnGhost, { marginTop: Spacing.sm }]} onPress={saveRowsAsTemplate}>
          <Text style={styles.btnGhostText}>このメニューをテンプレに保存</Text>
        </Pressable>
      </Card>

      <SectionTitle>今日のトレーニング</SectionTitle>
      {workouts.length === 0 ? (
        <Card><Text style={styles.muted}>まだ記録がありません</Text></Card>
      ) : workouts.map((w) => (
        <Pressable key={w.id} onLongPress={() => confirmDelete(w.id)}>
          <Card style={{ marginBottom: Spacing.sm }}>
            <Text style={styles.mealTime}>{fmtTime(w.timestamp)}{w.durationMin ? ` ・ ${w.durationMin}分` : ''}</Text>
            {w.exercises.map((e, i) => (
              <Text key={i} style={styles.mealName}>
                {e.exerciseName}
                {e.weight != null ? ` ${e.weight}${e.weightUnit ?? ''}` : ''}
                {e.reps > 1 || e.sets > 1 ? ` ${e.reps}回×${e.sets}セット` : ''}
              </Text>
            ))}
          </Card>
        </Pressable>
      ))}
      {workouts.length > 0 && <Text style={styles.hint}>長押しで削除できます</Text>}
    </>
  );
}

function AutoStat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.autoValue}>{value}</Text>
      <Text style={styles.autoLabel}>{label}{unit ? ` (${unit})` : ''}</Text>
    </View>
  );
}

// ============================== ストレス ==============================

function StressSection() {
  const [level, setLevel] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [logs, setLogs] = useState<StressLog[]>([]);

  const load = useCallback(async () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    setLogs(await listStressLogs(start.toISOString(), dayEnd.toISOString()));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const record = async () => {
    if (level == null) { Alert.alert('今の状態を選んでください'); return; }
    await addStressLog({
      id: newId(), timestamp: new Date().toISOString(),
      level, note: note.trim() || null,
    });
    setLevel(null); setNote('');
    load();
  };

  const confirmDelete = (id: string) => {
    Alert.alert('削除', 'この記録を削除しますか?', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: async () => { await deleteStressLog(id); load(); } },
    ]);
  };

  return (
    <>
      <SectionTitle>いまの状態</SectionTitle>
      <Card>
        <View style={styles.stressRow}>
          {STRESS_LEVELS.map((s) => (
            <Pressable
              key={s.level}
              style={[styles.stressBtn, level === s.level && styles.stressBtnActive]}
              onPress={() => setLevel(level === s.level ? null : s.level)}
            >
              <Text style={styles.stressEmoji}>{s.emoji}</Text>
              <Text style={[styles.stressLabel, level === s.level && { color: Colors.text, fontWeight: '700' }]}>
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={[styles.input, { marginTop: Spacing.md }]}
          value={note} onChangeText={setNote}
          placeholder="メモ(任意。例: 仕事が立て込んでる)"
          placeholderTextColor={Colors.textFaint}
        />
        <Pressable style={[styles.btn, styles.btnPrimary, { marginTop: Spacing.md }]} onPress={record}>
          <Text style={styles.btnPrimaryText}>記録する</Text>
        </Pressable>
        <Text style={styles.hintLeft}>ストレスはAIチャットの文脈に共有され、睡眠・回復との関係分析に使われます</Text>
      </Card>

      <SectionTitle>今日のストレス報告</SectionTitle>
      {logs.length === 0 ? (
        <Card><Text style={styles.muted}>まだ記録がありません</Text></Card>
      ) : logs.map((s) => {
        const def = STRESS_LEVELS.find((x) => x.level === s.level);
        return (
          <Pressable key={s.id} onLongPress={() => confirmDelete(s.id)}>
            <Card style={styles.mealRow}>
              <Text style={styles.stressEmoji}>{def?.emoji ?? '🧠'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.mealName}>{def?.label ?? s.level}</Text>
                <Text style={styles.mealTime}>{fmtTime(s.timestamp)}{s.note ? ` ・ ${s.note}` : ''}</Text>
              </View>
            </Card>
          </Pressable>
        );
      })}
      {logs.length > 0 && <Text style={styles.hint}>長押しで削除できます</Text>}
    </>
  );
}

// ============================== 共通 ==============================

function NumInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.numWrap}>
      <Text style={styles.numLabel}>{label}</Text>
      <TextInput
        style={styles.numInput}
        value={value} onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder="0" placeholderTextColor={Colors.textFaint}
      />
    </View>
  );
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  title: { color: Colors.text, fontSize: Type.title, fontFamily: Fonts.sans, fontWeight: '700' },
  bigTabs: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  bigTab: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 2, borderColor: Colors.border,
  },
  bigTabActive: { backgroundColor: Colors.accentDim, borderColor: Colors.accent },
  bigTabEmoji: { fontSize: 26 },
  bigTabLabel: { color: Colors.textSecondary, fontSize: Type.body, fontWeight: '600', marginTop: 4 },
  bigTabLabelActive: { color: Colors.text, fontWeight: '700' },
  totalCard: { marginTop: Spacing.md, alignItems: 'center', paddingVertical: Spacing.lg },
  totalKcal: {
    color: Colors.text, fontSize: 44, fontFamily: Fonts.display, fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  totalUnit: { fontSize: Type.body, color: Colors.textSecondary, fontWeight: '400' },
  totalPfc: { color: Colors.textSecondary, fontSize: Type.body, marginTop: 4, fontVariant: ['tabular-nums'] },
  photoRow: { flexDirection: 'row', gap: Spacing.sm },
  photoBtn: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md,
    alignItems: 'center', paddingVertical: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  photoBtnIcon: { fontSize: 28 },
  photoBtnText: { color: Colors.text, fontSize: Type.body, marginTop: 6, fontWeight: '600' },
  preview: { width: '100%', height: 180, borderRadius: Radius.sm, backgroundColor: Colors.bg },
  analyzing: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.md },
  analyzingText: { color: Colors.textSecondary, fontSize: Type.body },
  estName: { color: Colors.text, fontSize: Type.body, fontWeight: '700', marginTop: Spacing.md },
  estKcal: {
    color: Colors.text, fontSize: 32, fontFamily: Fonts.display, fontWeight: '700',
    fontVariant: ['tabular-nums'], marginTop: 2,
  },
  btnRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  btn: { flex: 1, borderRadius: Radius.sm, paddingVertical: 12, alignItems: 'center' },
  btnPrimary: { backgroundColor: Colors.accent },
  btnPrimaryText: { color: Colors.bg, fontWeight: '700', fontSize: Type.body },
  btnGhost: { backgroundColor: Colors.surfaceRaised },
  btnGhostText: { color: Colors.textSecondary, fontWeight: '600', fontSize: Type.body },
  input: {
    backgroundColor: Colors.bg, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
    color: Colors.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: Type.body,
  },
  inputGrid: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  numWrap: { flex: 1 },
  numLabel: { color: Colors.textSecondary, fontSize: Type.caption, marginBottom: 4 },
  numInput: {
    backgroundColor: Colors.bg, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
    color: Colors.text, paddingHorizontal: 8, paddingVertical: 8, fontSize: Type.body,
    fontVariant: ['tabular-nums'], textAlign: 'center',
  },
  unitBtn: {
    backgroundColor: Colors.surfaceRaised, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 8, alignItems: 'center',
  },
  unitBtnText: { color: Colors.text, fontSize: Type.body, fontWeight: '600' },
  muted: { color: Colors.textFaint, fontSize: Type.body },
  mealRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm, gap: Spacing.sm },
  mealName: { color: Colors.text, fontSize: Type.body },
  mealTime: { color: Colors.textFaint, fontSize: Type.caption, marginTop: 2, fontVariant: ['tabular-nums'] },
  mealKcal: { color: Colors.text, fontSize: Type.body, fontWeight: '700', fontVariant: ['tabular-nums'] },
  est: { color: Colors.warn, fontSize: Type.caption },
  hint: { color: Colors.textFaint, fontSize: Type.caption, textAlign: 'center', marginTop: Spacing.sm },
  hintLeft: { color: Colors.textFaint, fontSize: Type.caption, marginTop: Spacing.sm, lineHeight: 16 },
  autoRow: { flexDirection: 'row' },
  autoValue: { color: Colors.text, fontSize: 18, fontFamily: Fonts.display, fontWeight: '700', fontVariant: ['tabular-nums'] },
  autoLabel: { color: Colors.textFaint, fontSize: 10, marginTop: 2 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  stressRow: { flexDirection: 'row', gap: 6 },
  stressBtn: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.sm,
    borderRadius: Radius.sm, backgroundColor: Colors.bg,
    borderWidth: 1, borderColor: Colors.border,
  },
  stressBtnActive: { backgroundColor: Colors.accentDim, borderColor: Colors.accent },
  stressEmoji: { fontSize: 24 },
  stressLabel: { color: Colors.textSecondary, fontSize: 10, marginTop: 4 },
  scanRoot: { flex: 1, backgroundColor: '#000' },
  scanCamera: { flex: 1 },
  scanOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', gap: Spacing.lg,
  },
  scanHint: { color: '#FFF', fontSize: Type.body, fontWeight: '600' },
  scanFrame: {
    width: 260, height: 140, borderRadius: Radius.md,
    borderWidth: 3, borderColor: Colors.accent,
  },
  scanClose: {
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 999,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  scanCloseText: { color: '#FFF', fontSize: Type.body, fontWeight: '600' },
  tplWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tplChip: {
    backgroundColor: Colors.surface, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.accentDim,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  tplName: { color: Colors.text, fontSize: Type.body, fontWeight: '600' },
  tplKcal: { color: Colors.accent, fontSize: Type.caption, marginTop: 1, fontVariant: ['tabular-nums'] },
});
