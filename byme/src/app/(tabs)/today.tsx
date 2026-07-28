import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tri } from '../../components/tri';
import type { RitualMode } from '../../db/types';
import { buildPlaylist, estimateSeconds, playlistCounts } from '../../lib/playlist';
import { useAppStore } from '../../store/useAppStore';
import { colors, enLabel, fonts } from '../../theme/tokens';

/** TODAY: アプリの主役。開いた瞬間に「今日の儀式」を1タップで始められる */

const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];
const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

const MODE_LABELS: { key: RitualMode; en: string; jp: string }[] = [
  { key: 'quick', en: 'QUICK', jp: '60秒' },
  { key: 'standard', en: 'STANDARD', jp: '3分' },
  { key: 'full', en: 'FULL', jp: '全て' },
];

const COUNT_ROWS: { key: string; label: string }[] = [
  { key: 'AFFIRMATION', label: 'AFFIRMATIONS' },
  { key: 'IMAGING', label: 'IMAGING' },
  { key: 'GOAL', label: 'GOALS' },
  { key: 'NUMBER', label: 'NUMBERS' },
  { key: 'PRINCIPLE', label: 'PRINCIPLES' },
];

export default function Today() {
  const items = useAppStore((s) => s.items);
  const settings = useAppStore((s) => s.settings);
  const stats = useAppStore((s) => s.stats);
  const todayInProgress = useAppStore((s) => s.todayInProgress);
  const todayCompleted = useAppStore((s) => s.todayCompleted);
  const startOrResumeSession = useAppStore((s) => s.startOrResumeSession);

  const defaultMode = (settings.default_mode as RitualMode) ?? 'standard';
  const [mode, setMode] = useState<RitualMode>(
    MODE_LABELS.some((m) => m.key === defaultMode) ? defaultMode : 'standard'
  );

  const inProgress = todayInProgress();
  const completed = todayCompleted();

  const preview = useMemo(() => {
    const ids = buildPlaylist(items, mode, new Date(), {
      fullMaxItems: Number(settings.full_max_items ?? '40') || 40,
    });
    const counts = playlistCounts(items, ids);
    const secs = estimateSeconds(counts, Number(settings.seconds_per_screen ?? '8') || 8);
    return { counts, secs };
  }, [items, mode, settings.full_max_items, settings.seconds_per_screen]);

  const now = new Date();
  const dateLabel = `${MONTHS[now.getMonth()]} ${now.getDate()}, ${WEEKDAYS[now.getDay()]}`;
  const minutes = Math.max(1, Math.round(preview.secs / 60));

  const begin = async () => {
    const session = await startOrResumeSession(mode);
    router.push({ pathname: '/ritual', params: { sid: String(session.id) } });
  };

  const resume = async () => {
    if (!inProgress) return;
    const session = await startOrResumeSession(inProgress.mode);
    router.push({ pathname: '/ritual', params: { sid: String(session.id) } });
  };

  const review = () => {
    if (!completed) return;
    router.push({ pathname: '/ritual', params: { sid: String(completed.id), view: '1' } });
  };

  const showStreak = (settings.show_streak ?? '1') === '1';
  const showRate = (settings.show_rate ?? '1') === '1';

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.brand}>
            B<Text style={{ color: colors.blue }}>Y</Text>ME
          </Text>
          <Text style={styles.date}>{dateLabel}</Text>

          <Text style={styles.thesis}>今日、自分の人生を思い出す。</Text>

          {/* モード(初期値は設定のデフォルト。毎回選ばなくていい) */}
          <View style={styles.modeRow}>
            {MODE_LABELS.map((m) => (
              <Pressable
                key={m.key}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === m.key }}
                onPress={() => setMode(m.key)}
                style={[styles.modeBtn, mode === m.key && styles.modeBtnOn]}
              >
                <Text style={[styles.modeEn, mode === m.key && styles.modeEnOn]}>{m.en}</Text>
                <Text style={[styles.modeJp, mode === m.key && styles.modeJpOn]}>{m.jp}</Text>
              </Pressable>
            ))}
          </View>

          {/* 今日の儀式内容 */}
          <View style={styles.counts}>
            {COUNT_ROWS.map((r) => (
              <View key={r.key} style={styles.countRow}>
                <Text style={styles.countLabel}>{r.label}</Text>
                <Text style={styles.countNum}>{preview.counts[r.key] ?? 0}</Text>
              </View>
            ))}
            <Text style={styles.duration}>約{minutes}分</Text>
          </View>

          {/* メインCTA */}
          {inProgress && inProgress.mode === mode && inProgress.current_index > 0 ? (
            <>
              <Pressable accessibilityRole="button" style={styles.cta} onPress={resume}>
                <Tri size={13} color={colors.white} />
                <Text style={styles.ctaText}>続きから再開</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={begin} hitSlop={8}>
                <Text style={styles.subLink}>最初からやり直す</Text>
              </Pressable>
            </>
          ) : (
            <Pressable accessibilityRole="button" style={styles.cta} onPress={begin}>
              <Tri size={13} color={colors.white} />
              <Text style={styles.ctaText}>今日のBYMEを始める</Text>
            </Pressable>
          )}

          {completed ? (
            <Pressable accessibilityRole="button" onPress={review} hitSlop={8}>
              <Text style={styles.subLink}>✓ 今日は完了済み — 見返す</Text>
            </Pressable>
          ) : null}

          {/* 補助表示: ストリークだけに依存しない積み上げ情報 */}
          <View style={styles.statsRow}>
            {showStreak ? (
              <Text style={styles.statText}>
                <Text style={styles.statNum}>{stats.streak}</Text>日連続
              </Text>
            ) : null}
            <Text style={styles.statText}>
              今月 <Text style={styles.statNum}>{stats.monthDone}</Text> / {stats.monthDays}日
            </Text>
            {showRate ? (
              <Text style={styles.statText}>
                直近30日 <Text style={styles.statNum}>{stats.rate30}</Text>%
              </Text>
            ) : null}
          </View>
          <Text style={styles.total}>累計 {stats.totalDays}日</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const DARK_BG = '#0A101B';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: DARK_BG,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 26,
    paddingBottom: 40,
  },
  brand: {
    fontFamily: fonts.enBold,
    fontSize: 24,
    letterSpacing: 6,
    color: colors.white,
  },
  date: {
    ...enLabel,
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 6,
  },
  thesis: {
    fontFamily: fonts.jpBlack,
    fontSize: 24,
    lineHeight: 40,
    color: colors.white,
    marginTop: 44,
    marginBottom: 34,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 26,
  },
  modeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2,
  },
  modeBtnOn: {
    borderColor: colors.blue,
    backgroundColor: 'rgba(46,113,150,0.22)',
  },
  modeEn: {
    ...enLabel,
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },
  modeEnOn: {
    color: colors.white,
  },
  modeJp: {
    fontFamily: fonts.jp,
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
  },
  modeJpOn: {
    color: 'rgba(255,255,255,0.8)',
  },
  counts: {
    gap: 10,
    marginBottom: 30,
  },
  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  countLabel: {
    ...enLabel,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  countNum: {
    fontFamily: fonts.enSemi,
    fontSize: 18,
    color: colors.white,
    fontVariant: ['tabular-nums'],
  },
  duration: {
    fontFamily: fonts.jpMedium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 8,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.blue,
    borderRadius: 16,
    paddingVertical: 19,
    marginBottom: 14,
  },
  ctaText: {
    fontFamily: fonts.jpBold,
    fontSize: 17,
    color: colors.white,
  },
  subLink: {
    fontFamily: fonts.jp,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    paddingVertical: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 22,
    marginTop: 26,
  },
  statText: {
    fontFamily: fonts.jp,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  statNum: {
    fontFamily: fonts.enSemi,
    fontSize: 15,
    color: colors.white,
  },
  total: {
    fontFamily: fonts.jp,
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginTop: 10,
  },
});
