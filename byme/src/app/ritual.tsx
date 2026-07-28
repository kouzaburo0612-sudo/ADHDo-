import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Image, Pressable, StyleSheet, Text, View } from 'react-native';

// 音声読み上げ(OS標準)。ネイティブモジュール欠落時もアプリを落とさない
let Speech: { speak: (text: string, opts?: object) => void; stop: () => void } | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Speech = require('expo-speech');
} catch {
  Speech = null;
}
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tri } from '../components/tri';
import type {
  GoalExtra,
  ImagingExtra,
  NumberExtra,
  PrincipleExtra,
  RitualSession,
} from '../db/types';
import { parseExtra, parsePlaylist } from '../db/types';
import { expandSteps, type RitualStep } from '../lib/playlist';
import { splitSentences } from '../lib/sentences';
import { useAppStore } from '../store/useAppStore';
import { colors, enLabel, fonts } from '../theme/tokens';

/**
 * 儀式プレイヤー: 登録コンテンツから生成されたプレイリストを
 * AFFIRMATION → IMAGING → GOALS → NUMBERS → PRINCIPLES → COMPLETE の順で再生する。
 * - 1画面1メッセージ / タップ・自動送りで前進
 * - 進捗は1ステップごとにDBへ保存(アプリを閉じても続きから再開できる)
 * - 完了時に表示項目を実施済み記録(項目ごとのボタンは無い)
 */

const DARK: [string, string, string] = ['#050B12', '#101B2B', '#1B3A52'];
const FINALE: [string, string, string] = ['#0A1E2E', '#14405C', '#2E7196'];

const MODE_EN = { quick: 'QUICK', standard: 'STANDARD', full: 'FULL' } as const;

export default function Ritual() {
  const params = useLocalSearchParams<{ sid?: string; view?: string }>();
  const sid = Number(params.sid);
  const viewOnly = params.view === '1';

  const items = useAppStore((s) => s.items);
  const settings = useAppStore((s) => s.settings);
  const stats = useAppStore((s) => s.stats);
  const sessions = useAppStore((s) => s.sessions);
  const saveProgress = useAppStore((s) => s.saveProgress);
  const finishSession = useAppStore((s) => s.finishSession);

  // セッションはマウント時点のスナップショットで固定(完了処理での再取得ループを避ける)
  const sessionRef = useRef<RitualSession | null>(null);
  if (sessionRef.current === null) {
    sessionRef.current = sessions.find((s) => s.id === sid) ?? null;
  }
  const session = sessionRef.current;

  const steps = useMemo<RitualStep[]>(
    () => (session ? expandSteps(items, parsePlaylist(session)) : [{ kind: 'complete' }]),
    [items, session]
  );

  const startIndex = session && !viewOnly ? Math.min(session.current_index, steps.length - 1) : 0;
  const [idx, setIdx] = useState(startIndex);
  const [segIdx, setSegIdx] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const startedAtRef = useRef(Date.now());
  const baseElapsedRef = useRef(session?.elapsed_seconds ?? 0);
  const finishedRef = useRef(false);

  const step = steps[Math.min(idx, steps.length - 1)];
  const splitMode = (settings.aff_display ?? 'split') === 'split';
  const autoAdvance = (settings.auto_advance ?? '0') === '1';
  const secondsPerScreen = Math.max(3, Number(settings.seconds_per_screen ?? '8') || 8);
  const ttsEnabled = (settings.tts_enabled ?? '0') === '1';
  const hapticsEnabled = (settings.haptics_enabled ?? '1') === '1';
  const fontScale = Math.min(1.4, Math.max(0.8, Number(settings.font_scale ?? '1') || 1));
  const imageDim = Math.min(0.8, Math.max(0, Number(settings.image_dim ?? '0.35') || 0.35));

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  const elapsedNow = useCallback(
    () => baseElapsedRef.current + Math.round((Date.now() - startedAtRef.current) / 1000),
    []
  );

  // 現在ステップの読み上げ対象テキスト
  const speakText = useMemo(() => {
    switch (step.kind) {
      case 'aff':
        return splitMode ? splitSentences(step.item.body)[segIdx] ?? '' : step.item.body;
      case 'imaging':
      case 'principle':
        return step.item.body;
      case 'goal':
        return `${step.item.title}。${step.item.body}`;
      default:
        return '';
    }
  }, [step, segIdx, splitMode]);

  useEffect(() => {
    if (!ttsEnabled || !speakText || !Speech) return;
    Speech.stop();
    Speech.speak(speakText, { language: 'ja-JP', rate: 0.95 });
    return () => {
      Speech?.stop();
    };
  }, [speakText, ttsEnabled]);

  const advance = useCallback(async () => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    // アファメーションの文内送り
    if (step.kind === 'aff' && splitMode) {
      const sentences = splitSentences(step.item.body);
      if (segIdx < sentences.length - 1) {
        setSegIdx(segIdx + 1);
        return;
      }
    }

    if (step.kind === 'complete') {
      router.back();
      return;
    }

    const next = idx + 1;
    setIdx(next);
    setSegIdx(0);

    if (session && !viewOnly) {
      const isComplete = steps[next]?.kind === 'complete';
      await saveProgress(session.id, next, elapsedNow());
      if (isComplete && !finishedRef.current && session.status === 'IN_PROGRESS') {
        finishedRef.current = true;
        if (hapticsEnabled) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        await finishSession(session, elapsedNow());
      }
    }
  }, [step, splitMode, segIdx, idx, session, viewOnly, steps, saveProgress, finishSession, elapsedNow, hapticsEnabled]);

  // 自動送り(Reduce Motion時は無効)
  useEffect(() => {
    if (!autoAdvance || reduceMotion || step.kind === 'complete') return;
    const t = setTimeout(() => {
      advance();
    }, secondsPerScreen * 1000);
    return () => clearTimeout(t);
  }, [autoAdvance, reduceMotion, step, idx, segIdx, secondsPerScreen, advance]);

  const idxRef = useRef(idx);
  idxRef.current = idx;

  // 離脱時に現在位置を保存(閉じても同日なら続きから再開できる)
  useEffect(() => {
    return () => {
      Speech?.stop();
      const s = sessionRef.current;
      if (s && !viewOnly && !finishedRef.current && s.status === 'IN_PROGRESS') {
        saveProgress(s.id, Math.min(idxRef.current, steps.length - 1), baseElapsedRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!session) {
    // セッションが見つからなくても白画面にしない
    return (
      <LinearGradient colors={DARK} style={styles.fill}>
        <SafeAreaView style={[styles.fill, { justifyContent: 'center', padding: 30 }]}>
          <Text style={styles.bigText}>セッションが見つかりません。</Text>
          <Pressable onPress={() => router.back()} style={styles.close}>
            <Text style={styles.closeText}>閉じる</Text>
          </Pressable>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // 背景: IMAGINGで画像があれば全面表示、なければグラデーション
  const imaging = step.kind === 'imaging' ? parseExtra<ImagingExtra>(step.item) : null;
  const gradient: [string, string, string] =
    step.kind === 'imaging' && imaging?.gradient
      ? imaging.gradient
      : step.kind === 'complete'
        ? FINALE
        : DARK;

  const stepLabel = (() => {
    switch (step.kind) {
      case 'aff':
        return 'AFFIRMATION';
      case 'imaging':
        return 'IMAGING';
      case 'goal':
        return 'GOALS';
      case 'numbers-official':
      case 'numbers-imaging':
        return 'NUMBERS';
      case 'principle':
        return 'PRINCIPLES';
      default:
        return MODE_EN[session.mode];
    }
  })();

  return (
    <LinearGradient colors={gradient} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.fill}>
      {imaging?.imageUrl ? (
        <>
          <Image source={{ uri: imaging.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${imageDim})` }]} />
        </>
      ) : null}
      <SafeAreaView style={styles.fill}>
        <Pressable style={styles.body} onPress={advance} accessibilityLabel="次へ" accessibilityRole="button">
          {/* 簡潔な進捗 */}
          <View style={styles.progress}>
            {steps.map((_, i) => (
              <View key={i} style={[styles.seg, i <= idx && styles.segOn]} />
            ))}
          </View>
          <View style={styles.topRow}>
            <Text style={styles.stepTag}>{stepLabel}</Text>
            <Pressable
              hitSlop={10}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="閉じる"
              style={styles.close}
            >
              <Text style={styles.closeText}>閉じる</Text>
            </Pressable>
          </View>

          {step.kind === 'aff' ? (
            <View style={styles.content}>
              {step.item.title ? <Text style={styles.tag}>{step.item.title}</Text> : null}
              <Text style={[styles.affText, { fontSize: 26 * fontScale, lineHeight: 44 * fontScale }]}>
                {splitMode ? splitSentences(step.item.body)[segIdx] : step.item.body}
              </Text>
              {splitMode && splitSentences(step.item.body).length > 1 ? (
                <Text style={styles.segCount}>
                  {segIdx + 1} / {splitSentences(step.item.body).length}
                </Text>
              ) : null}
            </View>
          ) : null}

          {step.kind === 'imaging' ? (
            <View style={styles.content}>
              {imaging?.tag ? <Text style={styles.tag}>{imaging.tag}</Text> : null}
              {imaging?.numberText ? <Text style={styles.sceneNumber}>{imaging.numberText}</Text> : null}
              {imaging?.caption ? <Text style={styles.sceneCaption}>{imaging.caption}</Text> : null}
              <Text style={[styles.bigText, { fontSize: 21 * fontScale, lineHeight: 38 * fontScale }]}>
                {step.item.body}
              </Text>
              {imaging?.sensoryGuide?.length ? (
                <Text style={styles.guide}>{imaging.sensoryGuide.join('　')}</Text>
              ) : null}
            </View>
          ) : null}

          {step.kind === 'goal' ? (
            <GoalView item={step.item} fontScale={fontScale} />
          ) : null}

          {step.kind === 'numbers-official' ? (
            <View style={styles.content}>
              <Text style={styles.tag}>OFFICIAL TARGET — 正式目標</Text>
              {step.items.map((n) => {
                const ex = parseExtra<NumberExtra>(n);
                return (
                  <View key={n.id} style={styles.kpiRow}>
                    <Text style={styles.kpiLabel}>{n.title}</Text>
                    <Text style={styles.kpiValue}>
                      {ex.currentValue} / {ex.officialTarget}
                      {ex.unit}
                    </Text>
                  </View>
                );
              })}
              <Text style={styles.subText}>現在値 / 正式目標。1日も、1円も、ごまかせない。</Text>
            </View>
          ) : null}

          {step.kind === 'numbers-imaging' ? (
            <View style={styles.content}>
              <Text style={styles.tag}>IMAGING TARGET — 唱える数字</Text>
              {step.items.map((n) => {
                const ex = parseExtra<NumberExtra>(n);
                return (
                  <View key={n.id} style={styles.kpiRow}>
                    <Text style={styles.kpiLabel}>{n.title}</Text>
                    <Text style={[styles.kpiValue, { fontSize: 24 }]}>
                      {ex.imagingTarget}
                      {ex.unit}
                    </Text>
                  </View>
                );
              })}
              <Text style={styles.subText}>声に出して唱える数字。正式目標とは別に管理されている。</Text>
            </View>
          ) : null}

          {step.kind === 'principle' ? (
            <View style={styles.content}>
              <Text style={styles.tag}>
                {parseExtra<PrincipleExtra>(step.item).role === 'ROTATING'
                  ? (parseExtra<PrincipleExtra>(step.item).category ?? 'PRINCIPLE')
                  : 'CORE'}
              </Text>
              <Text style={[styles.bigText, { fontSize: 24 * fontScale, lineHeight: 42 * fontScale }]}>
                {step.item.body}
              </Text>
            </View>
          ) : null}

          {step.kind === 'complete' ? (
            <View style={styles.doneCenter}>
              <Tri size={26} color={colors.white} />
              <Text style={styles.doneEn}>COMPLETE</Text>
              <Text style={styles.doneJp}>
                {viewOnly ? '今日のセッションを見返しました。' : '今日の刷り込み、完了。'}
              </Text>
              <Text style={styles.doneStreak}>
                {stats.streak}日連続 / 今月{stats.monthDone}日 / 累計{stats.totalDays}日
              </Text>
            </View>
          ) : null}

          <Text style={styles.hint}>
            {step.kind === 'complete'
              ? 'タップして戻る'
              : step.kind === 'numbers-official'
                ? '目に焼き付ける — TAP'
                : '声に出して唱える — TAP'}
          </Text>
        </Pressable>
      </SafeAreaView>
    </LinearGradient>
  );
}

function GoalView({ item, fontScale }: { item: import('../db/types').ContentItem; fontScale: number }) {
  const ex = parseExtra<GoalExtra>(item);
  const horizonJp = { SHORT: '短期', MID: '中期', LONG: '長期' }[ex.horizon ?? 'LONG'];
  return (
    <View style={styles.content}>
      <Text style={styles.tag}>
        {(ex.horizon ?? 'LONG') + ' TERM — ' + horizonJp}
      </Text>
      {ex.targetYear ? <Text style={styles.sceneNumber}>{ex.targetYear}</Text> : null}
      <Text style={[styles.bigText, { fontSize: 22 * fontScale, lineHeight: 38 * fontScale }]}>
        {item.title}
      </Text>
      {item.body ? <Text style={styles.subText}>{item.body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: 'center',
  },
  progress: {
    position: 'absolute',
    top: 14,
    left: 30,
    right: 30,
    flexDirection: 'row',
    gap: 3,
  },
  seg: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  segOn: {
    backgroundColor: colors.white,
  },
  topRow: {
    position: 'absolute',
    top: 30,
    left: 30,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1,
  },
  stepTag: {
    ...enLabel,
    fontSize: 11,
    letterSpacing: 4,
    color: 'rgba(255,255,255,0.5)',
  },
  close: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  closeText: {
    fontFamily: fonts.jp,
    fontSize: 12,
    color: colors.white,
  },
  content: {
    gap: 14,
  },
  tag: {
    ...enLabel,
    fontSize: 12,
    letterSpacing: 4,
    color: 'rgba(255,255,255,0.7)',
  },
  affText: {
    fontFamily: fonts.jpBlack,
    color: colors.white,
  },
  segCount: {
    fontFamily: fonts.en,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  bigText: {
    fontFamily: fonts.jpBlack,
    color: colors.white,
  },
  subText: {
    fontFamily: fonts.jpMedium,
    fontSize: 13,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.65)',
  },
  guide: {
    fontFamily: fonts.jp,
    fontSize: 11,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 6,
  },
  sceneNumber: {
    fontFamily: fonts.enSemi,
    fontSize: 64,
    lineHeight: 72,
    color: colors.white,
  },
  sceneCaption: {
    fontFamily: fonts.jpMedium,
    fontSize: 13,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.75)',
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 9,
  },
  kpiLabel: {
    fontFamily: fonts.jpMedium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  kpiValue: {
    fontFamily: fonts.en,
    fontSize: 16,
    color: colors.white,
    fontVariant: ['tabular-nums'],
  },
  doneCenter: {
    alignItems: 'center',
    gap: 16,
  },
  doneEn: {
    ...enLabel,
    fontSize: 16,
    color: colors.white,
  },
  doneJp: {
    fontFamily: fonts.jpBold,
    fontSize: 14,
    lineHeight: 26,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  doneStreak: {
    fontFamily: fonts.enSemi,
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  hint: {
    position: 'absolute',
    bottom: 40,
    left: 30,
    fontFamily: fonts.jp,
    fontSize: 10,
    letterSpacing: 3,
    color: 'rgba(255,255,255,0.55)',
  },
});
