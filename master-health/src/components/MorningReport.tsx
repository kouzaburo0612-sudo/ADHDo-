/**
 * 朝の報告カード(トレーナー毎日報告用)
 * ======================================
 * My Bodyタブ最上部の1枚のカード。スクリーンショット1枚(または自動生成テキスト)で
 * トレーナーへの毎朝の報告が完結する。
 *
 * - 自動抽出ゾーン(2×2タイル・「自動」バッジ): 体重 / 睡眠(Ouraスコア+時間) /
 *   昨日のアクティビティスコア(Oura) / 昨日の歩数 — 完全自動・手入力UIなし
 * - 体調(1〜5): 唯一の必須手入力(丸ボタン)
 * - 昨日の過ごし方: 歩数から自動判定(〜4,000=座り中心 / 〜8,000=移動多め /
 *   8,000超=よく動いた)、チップで手動上書き可
 * - 昨日のトレーニング: なし/あり。ありの場合に場所(石垣島/東京/LA/その他[自由記述])・
 *   部位(複数)・分数。アプリ内ワークアウト記録から「あり」+分数を自動初期値
 * - 送信テキストのリアルタイムプレビュー+「画像で共有」「テキストをコピー」
 *
 * 入力はmorning_reportsテーブルに日次保存(後からトレンド分析に使える)。
 * 正午以降は折りたたみ表示(タップで展開)。食事の項目は含めない(仕様)。
 */
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { useFocusEffect } from 'expo-router';

import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import { getRange } from '@/lib/db';
import { addDays, fromKey, toKey, todayKey } from '@/lib/dates';
import {
  getMorningReport, listWorkoutLogs, localDateKey, saveMorningReport,
  type MorningReportEntry,
} from '@/lib/store';

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];
const PLACES = ['石垣島', '東京', 'LA', 'その他'];
const PARTS = ['胸', '背中', '肩', '脚', '全身', '有酸素'];
const MINUTES = [30, 45, 50, 60, 75, 90];
const LIFESTYLES = ['座り中心', '移動多め', 'よく動いた'];

/** 昨日の歩数からの自動判定(〜4,000=座り中心 / 4,000〜8,000=移動多め / 8,000超=よく動いた) */
const lifestyleAuto = (steps: number | null): string | null => {
  if (steps == null) return null;
  if (steps <= 4000) return '座り中心';
  if (steps <= 8000) return '移動多め';
  return 'よく動いた';
};

const fmtSleep = (min: number | null): string | null => {
  if (min == null) return null;
  const m = Math.round(min);
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`;
};

/** 自動抽出した計測値(体重は当日分のみ。carry-forwardしない=未計測は未計測と出す) */
interface AutoData {
  weightKg: number | null;
  sleepScore: number | null;
  sleepMin: number | null;
  yActivityScore: number | null;
  ySteps: number | null;
  /** 昨日のアプリ内ワークアウト合計分(あれば「あり」+分数の自動初期値に使う) */
  yWorkoutMin: number | null;
  yWorkoutAny: boolean;
}

async function loadAuto(tk: string, yk: string): Promise<AutoData> {
  const range = await getRange(yk, tk);
  const today = range.get(tk) ?? {};
  const yday = range.get(yk) ?? {};

  const qFrom = addDays(fromKey(yk), -1).toISOString();
  const qTo = addDays(fromKey(yk), 2).toISOString();
  const yWorkouts = (await listWorkoutLogs(qFrom, qTo)).filter((w) => localDateKey(w.timestamp) === yk);
  const yWorkoutMin = yWorkouts.reduce((a, w) => a + (w.durationMin ?? 0), 0);

  return {
    weightKg: today.weight ?? null,
    sleepScore: today.oura_sleep_score ?? null,
    sleepMin: today.sleep_total ?? null,
    yActivityScore: yday.oura_activity_score ?? null,
    ySteps: yday.steps != null ? Math.round(yday.steps) : null,
    yWorkoutMin: yWorkoutMin > 0 ? Math.round(yWorkoutMin) : null,
    yWorkoutAny: yWorkouts.length > 0 || (yday.workout_energy ?? 0) > 50,
  };
}

/** 分数を選択肢(30/45/50/60/75/90)の最も近い値に丸める */
const nearestMinutes = (m: number): number =>
  MINUTES.reduce((best, v) => (Math.abs(v - m) < Math.abs(best - m) ? v : best), MINUTES[0]);

function emptyEntry(date: string): MorningReportEntry {
  return {
    date, condition: null, lifestyle: null,
    trainingDone: null, trainingPlace: null, trainingParts: [], trainingMinutes: null,
  };
}

/** 送信テキスト(トレーナー指定フォーマット。欠損は「—」のまま含める) */
export function buildMorningText(tk: string, auto: AutoData, e: MorningReportEntry): string {
  const d = fromKey(tk);
  const na = '—';
  const sleep = auto.sleepScore != null || auto.sleepMin != null
    ? `${auto.sleepScore ?? na}/${fmtSleep(auto.sleepMin) ?? na}`
    : na;
  const lifestyle = e.lifestyle ?? lifestyleAuto(auto.ySteps) ?? na;
  const done = e.trainingDone ?? auto.yWorkoutAny;
  let training = 'なし';
  if (done) {
    const place = e.trainingPlace && e.trainingPlace.trim() !== '' ? e.trainingPlace.trim() : na;
    const parts = e.trainingParts.length > 0 ? e.trainingParts.join('・') : na;
    const min = e.trainingMinutes ?? (auto.yWorkoutMin != null ? nearestMinutes(auto.yWorkoutMin) : null);
    training = `あり(${place}/${parts}/${min != null ? `${min}分` : na})`;
  }
  return [
    `【${d.getMonth() + 1}/${d.getDate()} 朝の記録】`,
    `・体重:${auto.weightKg != null ? `${(Math.round(auto.weightKg * 10) / 10).toFixed(1)}kg` : na}`,
    `・体調(1〜5):${e.condition ?? na}`,
    `・睡眠(Ouraスコア/時間):${sleep}`,
    `・昨日の過ごし方:${lifestyle}`,
    `・昨日のアクティビティスコア(Oura):${auto.yActivityScore ?? na}`,
    `・昨日の歩数:${auto.ySteps != null ? auto.ySteps.toLocaleString() : na}`,
    `・昨日のトレーニング:${training}`,
  ].join('\n');
}

export function MorningReportCard() {
  const tk = todayKey();
  const yk = toKey(addDays(fromKey(tk), -1));
  // 正午以降は折りたたみ(タップで展開)
  const [collapsed, setCollapsed] = useState(() => new Date().getHours() >= 12);
  const [auto, setAuto] = useState<AutoData | null>(null);
  const [entry, setEntry] = useState<MorningReportEntry>(() => emptyEntry(tk));
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<View>(null);

  const load = useCallback(() => {
    let active = true;
    (async () => {
      try {
        const [a, saved] = await Promise.all([loadAuto(tk, yk), getMorningReport(tk)]);
        if (!active) return;
        setAuto(a);
        setEntry(saved ?? emptyEntry(tk));
      } catch { /* 次のフォーカスで再試行 */ }
    })();
    return () => { active = false; };
  }, [tk, yk]);

  useFocusEffect(load);
  useEffect(load, [load]);

  const update = useCallback((patch: Partial<MorningReportEntry>) => {
    setEntry((prev) => {
      const next = { ...prev, ...patch };
      saveMorningReport(next).catch(() => {});
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  if (auto == null) return null;

  // トレーニング有無: 手動入力 > ワークアウト記録からの自動初期値
  const trainingDone = entry.trainingDone ?? auto.yWorkoutAny;
  const effMinutes = entry.trainingMinutes ?? (auto.yWorkoutMin != null ? nearestMinutes(auto.yWorkoutMin) : null);
  const autoLife = lifestyleAuto(auto.ySteps);
  const effLifestyle = entry.lifestyle ?? autoLife;
  const placeIsOther = entry.trainingPlace != null && !['石垣島', '東京', 'LA'].includes(entry.trainingPlace);
  const text = buildMorningText(tk, auto, { ...entry, trainingDone, trainingMinutes: effMinutes });
  const d = fromKey(tk);

  const onShareImage = async () => {
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
      await Share.share({ url: uri });
    } catch {
      Alert.alert('画像の書き出しに失敗しました', '「テキストをコピー」をお使いください。');
    }
  };

  const onCopy = async () => {
    try {
      await Clipboard.setStringAsync(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch { Alert.alert('コピーに失敗しました'); }
  };

  return (
    <View style={styles.card} ref={cardRef} collapsable={false}>
      {/* ヘッダー(タップで折りたたみ切替) */}
      <Pressable onPress={() => setCollapsed((c) => !c)} style={styles.headRow}>
        <Text style={styles.headTitle}>
          {d.getMonth() + 1}/{d.getDate()}({WEEKDAYS_JA[d.getDay()]}) 朝の記録
        </Text>
        <Text style={styles.chevron}>{collapsed ? '▸' : '▾'}</Text>
      </Pressable>
      {collapsed && (
        <Text style={styles.collapsedHint}>
          タップで展開{entry.condition != null ? ` ・ 体調${entry.condition}で入力済み` : ' ・ 体調が未入力です'}
        </Text>
      )}

      {!collapsed && (
        <>
          {/* 自動抽出ゾーン(2×2・手入力なし) */}
          <View style={styles.tileRow}>
            <AutoTile
              label="体重"
              value={auto.weightKg != null ? `${(Math.round(auto.weightKg * 10) / 10).toFixed(1)}kg` : '未計測'}
              sub={auto.weightKg != null ? '今朝の計測' : '体重計に乗ると自動で入ります'}
              dim={auto.weightKg == null}
            />
            <AutoTile
              label="睡眠"
              value={auto.sleepScore != null
                ? `${auto.sleepScore} / ${fmtSleep(auto.sleepMin) ?? '—'}`
                : fmtSleep(auto.sleepMin) ?? '—'}
              sub={auto.sleepScore != null ? 'Ouraスコア / 時間' : auto.sleepMin != null ? '時間(Watch)' : 'データなし'}
              dim={auto.sleepScore == null && auto.sleepMin == null}
            />
          </View>
          <View style={styles.tileRow}>
            <AutoTile
              label="アクティビティ(昨日)"
              value={auto.yActivityScore != null ? String(auto.yActivityScore) : '—'}
              sub={auto.yActivityScore != null ? 'Ouraスコア' : 'データなし'}
              dim={auto.yActivityScore == null}
            />
            <AutoTile
              label="昨日の歩数"
              value={auto.ySteps != null ? auto.ySteps.toLocaleString() : '—'}
              sub={auto.ySteps != null ? 'ヘルスケア実測' : 'データなし'}
              dim={auto.ySteps == null}
            />
          </View>

          {/* 体調(唯一の必須手入力) */}
          <Text style={styles.rowLabel}>体調(1〜5)</Text>
          <View style={styles.condRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                style={[styles.condBtn, entry.condition === n && styles.condBtnActive]}
                onPress={() => update({ condition: entry.condition === n ? null : n })}
              >
                <Text style={[styles.condText, entry.condition === n && styles.condTextActive]}>{n}</Text>
              </Pressable>
            ))}
          </View>

          {/* 昨日の過ごし方(自動判定+手動上書き) */}
          <Text style={styles.rowLabel}>
            昨日の過ごし方
            {autoLife != null && entry.lifestyle == null && (
              <Text style={styles.autoNote}>  自動判定: {autoLife}</Text>
            )}
          </Text>
          <View style={styles.chipRow}>
            {LIFESTYLES.map((l) => (
              <Chip
                key={l}
                label={l}
                active={effLifestyle === l}
                onPress={() => update({ lifestyle: entry.lifestyle === l ? null : l })}
              />
            ))}
          </View>

          {/* 昨日のトレーニング */}
          <Text style={styles.rowLabel}>
            昨日のトレーニング
            {entry.trainingDone == null && auto.yWorkoutAny && (
              <Text style={styles.autoNote}>  記録から自動で「あり」</Text>
            )}
          </Text>
          <View style={styles.chipRow}>
            <Chip label="なし" active={!trainingDone} onPress={() => update({ trainingDone: false })} />
            <Chip label="あり" active={trainingDone} onPress={() => update({ trainingDone: true })} />
          </View>
          {trainingDone && (
            <>
              <Text style={styles.subLabel}>場所</Text>
              <View style={styles.chipRow}>
                {PLACES.map((p) => {
                  const active = p === 'その他' ? placeIsOther : entry.trainingPlace === p;
                  return (
                    <Chip
                      key={p}
                      label={p}
                      active={active}
                      onPress={() => update({ trainingPlace: p === 'その他' ? '' : (entry.trainingPlace === p ? null : p) })}
                    />
                  );
                })}
              </View>
              {placeIsOther && (
                <TextInput
                  style={styles.placeInput}
                  value={entry.trainingPlace ?? ''}
                  onChangeText={(v) => update({ trainingPlace: v })}
                  placeholder="場所を入力(例: 大阪・出張先ホテル)"
                  placeholderTextColor={Colors.textFaint}
                />
              )}
              <Text style={styles.subLabel}>部位(複数可)</Text>
              <View style={styles.chipRow}>
                {PARTS.map((p) => (
                  <Chip
                    key={p}
                    label={p}
                    active={entry.trainingParts.includes(p)}
                    onPress={() => update({
                      trainingParts: entry.trainingParts.includes(p)
                        ? entry.trainingParts.filter((x) => x !== p)
                        : [...entry.trainingParts, p],
                    })}
                  />
                ))}
              </View>
              <Text style={styles.subLabel}>
                分数
                {entry.trainingMinutes == null && auto.yWorkoutMin != null && (
                  <Text style={styles.autoNote}>  記録から約{auto.yWorkoutMin}分</Text>
                )}
              </Text>
              <View style={styles.chipRow}>
                {MINUTES.map((m) => (
                  <Chip
                    key={m}
                    label={`${m}分`}
                    active={effMinutes === m}
                    onPress={() => update({ trainingMinutes: entry.trainingMinutes === m ? null : m })}
                  />
                ))}
              </View>
            </>
          )}

          {/* 送信テキスト プレビュー(選択に連動してリアルタイム生成) */}
          <View style={styles.previewBox}>
            <Text style={styles.previewText} selectable>{text}</Text>
          </View>

          <Pressable style={styles.primaryBtn} onPress={onShareImage}>
            <Text style={styles.primaryBtnText}>📤 画像で共有</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={onCopy}>
            <Text style={styles.secondaryBtnText}>{copied ? '✅ コピーしました' : '📋 テキストをコピー'}</Text>
          </Pressable>
          <Text style={styles.brand}>VYTA</Text>
        </>
      )}
    </View>
  );
}

function AutoTile({ label, value, sub, dim }: { label: string; value: string; sub: string; dim?: boolean }) {
  return (
    <View style={styles.tile}>
      <View style={styles.tileHead}>
        <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
        <View style={styles.autoBadge}><Text style={styles.autoBadgeText}>自動</Text></View>
      </View>
      <Text style={[styles.tileValue, dim && { color: Colors.textFaint, fontSize: Type.body }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.tileSub} numberOfLines={1}>{sub}</Text>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headTitle: { color: Colors.text, fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  chevron: { color: Colors.textSecondary, fontSize: 16 },
  collapsedHint: { color: Colors.textFaint, fontSize: Type.caption, marginTop: 4 },
  tileRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  tile: {
    flex: 1, backgroundColor: Colors.surfaceRaised, borderRadius: 12,
    padding: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  tileHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  tileLabel: { color: Colors.textSecondary, fontSize: Type.label, flexShrink: 1 },
  autoBadge: { backgroundColor: Colors.accentDim, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  autoBadgeText: { color: Colors.accent, fontSize: 9, fontWeight: '700' },
  tileValue: {
    color: Colors.text, fontSize: 20, fontFamily: Fonts.display, fontWeight: '700',
    fontVariant: ['tabular-nums'], marginTop: 4,
  },
  tileSub: { color: Colors.textFaint, fontSize: 10, marginTop: 2 },
  rowLabel: { color: Colors.textSecondary, fontSize: Type.body, marginTop: Spacing.md },
  subLabel: { color: Colors.textFaint, fontSize: Type.caption, marginTop: Spacing.sm },
  autoNote: { color: Colors.accent, fontSize: Type.caption, fontWeight: '400' },
  condRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  condBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceRaised, borderWidth: 1, borderColor: Colors.border,
  },
  condBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  condText: { color: Colors.textSecondary, fontSize: 17, fontWeight: '700' },
  condTextActive: { color: Colors.bg },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: Colors.surfaceRaised, borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.accentDim, borderColor: Colors.accent },
  chipText: { color: Colors.textSecondary, fontSize: Type.body, fontWeight: '600' },
  chipTextActive: { color: Colors.accent },
  placeInput: {
    marginTop: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.accent,
    backgroundColor: Colors.surfaceRaised, color: Colors.text,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: Type.body,
  },
  previewBox: {
    marginTop: Spacing.md, backgroundColor: Colors.bg, borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, padding: 12,
  },
  previewText: { color: Colors.text, fontSize: 13, lineHeight: 21, fontVariant: ['tabular-nums'] },
  primaryBtn: {
    marginTop: Spacing.md, backgroundColor: Colors.accent, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  primaryBtnText: { color: Colors.bg, fontSize: Type.body, fontWeight: '800' },
  secondaryBtn: {
    marginTop: Spacing.sm, backgroundColor: Colors.surfaceRaised, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, paddingVertical: 14, alignItems: 'center',
  },
  secondaryBtnText: { color: Colors.text, fontSize: Type.body, fontWeight: '700' },
  brand: {
    color: Colors.textFaint, fontSize: Type.label, fontFamily: Fonts.brand,
    textAlign: 'right', marginTop: 8, letterSpacing: 2,
  },
});
