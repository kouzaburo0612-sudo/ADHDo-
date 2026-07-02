export const CATS = {
  workout: { name: '筋トレ', hex: '#f4526a', icon: '💪' },
  work: { name: 'Work', hex: '#4a8df8', icon: '💻' },
  meal: { name: '食事', hex: '#d97706', icon: '🍙' },
  sleep: { name: '睡眠', hex: '#9d7bf5', icon: '🌙' },
  routine: { name: 'ルーティン', hex: '#0da06f', icon: '🌿' },
};

// start/end は 0:00 からの分。end < start は日付をまたぐ(睡眠)
export const SCHEDULE = [
  { id: 'am-routine', cat: 'routine', title: 'モーニングルーティン', start: 390, end: 450, subs: [
    { name: '起床・水分補給', start: 390, end: 405 },
    { name: '瞑想', start: 405, end: 425 },
    { name: 'シャワー・身支度', start: 425, end: 450 },
  ]},
  { id: 'breakfast', cat: 'meal', title: '朝食', start: 450, end: 480 },
  { id: 'workout', cat: 'workout', title: '筋トレ', start: 480, end: 540, subs: [
    { name: 'ウォームアップ', start: 480, end: 490 },
    { name: 'ベンチプレス', start: 490, end: 510 },
    { name: 'スクワット', start: 510, end: 530 },
    { name: 'クールダウン', start: 530, end: 540 },
  ]},
  { id: 'work-am', cat: 'work', title: 'Work(午前)', start: 540, end: 720, subs: [
    { name: 'メール・タスク整理', start: 540, end: 570 },
    { name: '集中タスク', start: 570, end: 690 },
    { name: 'ミーティング', start: 690, end: 720 },
  ]},
  { id: 'lunch', cat: 'meal', title: '昼食・休憩', start: 720, end: 780 },
  { id: 'work-pm', cat: 'work', title: 'Work(午後)', start: 780, end: 1080, subs: [
    { name: '集中タスク', start: 780, end: 900 },
    { name: '休憩・軽いストレッチ', start: 900, end: 915 },
    { name: 'タスク処理', start: 915, end: 1050 },
    { name: '振り返り・明日の計画', start: 1050, end: 1080 },
  ]},
  { id: 'dinner', cat: 'meal', title: '夕食', start: 1080, end: 1140 },
  { id: 'ev-routine', cat: 'routine', title: 'イブニングルーティン', start: 1140, end: 1290, subs: [
    { name: '散歩', start: 1140, end: 1180 },
    { name: '自由時間', start: 1180, end: 1260 },
    { name: '片付け', start: 1260, end: 1290 },
  ]},
  { id: 'night-routine', cat: 'routine', title: 'ナイトルーティン', start: 1290, end: 1380, subs: [
    { name: '日記', start: 1290, end: 1320 },
    { name: '瞑想', start: 1320, end: 1340 },
    { name: 'ストレッチ', start: 1340, end: 1360 },
    { name: '就寝準備', start: 1360, end: 1380 },
  ]},
  { id: 'sleep', cat: 'sleep', title: '睡眠', start: 1380, end: 390 },
];

export const fmt = (m) =>
  `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const dur = (e) => (e.end - e.start + 1440) % 1440;
export const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
export const isActive = (e, n) => (e.start < e.end ? n >= e.start && n < e.end : n >= e.start || n < e.end);
export const isPast = (e, n) => e.start < e.end && n >= e.end;
export const durLabel = (m) =>
  m >= 60 ? (m % 60 ? `${Math.floor(m / 60)}時間${m % 60}分` : `${Math.floor(m / 60)}時間`) : `${m}分`;
export const WEEKDAYS = '日月火水木金土';
