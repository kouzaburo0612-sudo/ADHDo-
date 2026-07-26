/**
 * 心得プリセット。
 * 経営者テンプレートが本命(約30項目)。他はPhase 1ではダミー3件ずつ。
 */
export interface PresetPrinciple {
  source: string;
  text: string;
}

export interface PrincipleTemplate {
  key: 'ceo' | 'athlete' | 'student' | 'general';
  labelEn: string;
  labelJp: string;
  description: string;
  items: PresetPrinciple[];
}

const CEO_ITEMS: PresetPrinciple[] = [
  // --- CEOの8つの仕事 ---
  { source: 'CEOの8つの仕事', text: '会社の未来を描くのは自分しかいない。ビジョンを語り続けよ。' },
  { source: 'CEOの8つの仕事', text: 'やらないことを決めよ。戦略とは捨てる決断である。' },
  { source: 'CEOの8つの仕事', text: '自分より優秀な人を採り、任せ、育てよ。' },
  { source: 'CEOの8つの仕事', text: '文化は放っておけば腐る。理念を毎日語れ。' },
  { source: 'CEOの8つの仕事', text: 'キャッシュは血液。資金の流れから目を離すな。' },
  { source: 'CEOの8つの仕事', text: '最終責任はすべて自分にある。言い訳を捨てよ。' },
  { source: 'CEOの8つの仕事', text: '現場に出よ。顧客の声だけが真実を語る。' },
  { source: 'CEOの8つの仕事', text: '自分の器以上に会社は育たない。まず自分を磨け。' },
  // --- 経営の法則 ---
  { source: '経営の法則', text: '売上はすべてを癒す。まず売れ。' },
  { source: '経営の法則', text: '利益は目的ではなく、続けるための条件である。' },
  { source: '経営の法則', text: '小さく試し、速く学び、大きく張れ。' },
  { source: '経営の法則', text: '値決めは経営。安売りは自分の価値への裏切りである。' },
  { source: '経営の法則', text: '固定費は敵。身軽さは戦略である。' },
  { source: '経営の法則', text: '迷ったら、顧客が喜ぶ方を選べ。' },
  // --- ジャック・マー ---
  { source: 'ジャック・マー', text: '今日は厳しい。明日はもっと厳しい。しかし明後日は美しい。' },
  { source: 'ジャック・マー', text: '断られてからが始まりだ。拒絶に慣れよ。' },
  { source: 'ジャック・マー', text: '賢い人より、信じ抜く人が勝つ。' },
  { source: 'ジャック・マー', text: '不満のあるところにチャンスがある。' },
  { source: 'ジャック・マー', text: '35歳で貧しいなら、それはあなたの責任だ。' },
  // --- 成功法則 ---
  { source: '成功法則', text: '目標を紙に書け。毎日見よ。声に出せ。' },
  { source: '成功法則', text: 'すでに達成した自分として、今日を生きよ。' },
  { source: '成功法則', text: '環境が人をつくる。付き合う人を選べ。' },
  { source: '成功法則', text: '一流に触れよ。基準が変われば行動が変わる。' },
  { source: '成功法則', text: '朝の1時間は夜の3時間に勝る。' },
  { source: '成功法則', text: '継続だけが裏切らない。今日もやれ。' },
  // --- ダルマの法則 ---
  { source: 'ダルマの法則', text: '与えよ。富は循環の中でしか増えない。' },
  { source: 'ダルマの法則', text: '執着を手放せ。結果は自然についてくる。' },
  { source: 'ダルマの法則', text: 'あなたには果たすべき役割がある。才を世のために使え。' },
  { source: 'ダルマの法則', text: '今この瞬間に集中せよ。過去も未来も幻想である。' },
  { source: 'ダルマの法則', text: '心が静かなとき、最良の決断が生まれる。' },
];

export const PRINCIPLE_TEMPLATES: PrincipleTemplate[] = [
  {
    key: 'ceo',
    labelEn: 'CEO',
    labelJp: '経営者',
    description: 'CEOの8つの仕事・経営の法則・ジャック・マー・成功法則・ダルマの法則(約30項目)',
    items: CEO_ITEMS,
  },
  {
    key: 'athlete',
    labelEn: 'ATHLETE',
    labelJp: 'アスリート',
    description: '勝負の心得(Phase 1はサンプル3項目)',
    items: [
      { source: '勝負の心得', text: '練習は嘘をつかない。今日の一本に全てを込めよ。' },
      { source: '勝負の心得', text: '身体は資本。食事と睡眠も練習である。' },
      { source: '勝負の心得', text: '勝った自分を毎日鮮明にイメージせよ。' },
    ],
  },
  {
    key: 'student',
    labelEn: 'STUDENT',
    labelJp: '受験生',
    description: '合格の心得(Phase 1はサンプル3項目)',
    items: [
      { source: '合格の心得', text: '合格した自分から逆算して今日の一問を解け。' },
      { source: '合格の心得', text: '昨日の自分だけがライバルである。' },
      { source: '合格の心得', text: '不安は行動でしか消えない。机に向かえ。' },
    ],
  },
  {
    key: 'general',
    labelEn: 'GENERAL',
    labelJp: '汎用',
    description: '人生の心得(Phase 1はサンプル3項目)',
    items: [
      { source: '人生の心得', text: '人生は、自分の手で創る。' },
      { source: '人生の心得', text: '今日できる最小の一歩を、必ず踏み出せ。' },
      { source: '人生の心得', text: 'なりたい自分として、今日を生きよ。' },
    ],
  },
];
