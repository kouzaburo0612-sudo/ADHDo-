/**
 * BYME マスターコンテンツ(byme-master-content §1〜4)のシードデータ。
 * このファイルが文言の「正」。勝手に変えない。
 * 体験クエストは更新版マスターコンテンツの全28件を収録。
 */

// ---------- §1-1 アイデンティティ / §1-2 MVV / §1-3 テーマ ----------

export const IDENTITY = '私は、離島から1兆円へ向かうRPGの主人公である';

export const MVV = {
  mission:
    'すべての『楽しかった』のために。— 全力で燃え、「おもろく」生きる。資本が能力ある経営者に流れる仕組みを、離島から書き換える。',
  vision:
    'Swim in the mud. 泥の中でも、進み続けるチームであれ。— 2034年、時価総額6,500億円でIPO。離島から1兆円企業へ。',
  valuesCompany: '安全第一(お客様とスタッフの人命を最優先)\nリスペクト(信頼して任せ、互いに高めあう)\nスピード(より早く、よりシンプルに)',
} as const;

/** 2026年 戒め3カ条(VALUES個人)。コックピット指針バーで日替わり1件+MINDで全文 */
export const CREED = [
  '短期的快楽に走るな。長期的幸福を追い求めよ。',
  '退屈を楽しみ、圧倒的な反復をせよ。',
  '人に感謝され、喜ばれることをせよ。',
] as const;

export const THEME_2026 = '①自制心×利他心 ②もっと自分に素直に生きる ③性欲のコントロール';

// ---------- §1-4 アファメーション(上映用・5篇) ----------

export const AFFIRMATIONS: { title: string; body: string }[] = [
  {
    title: '① 自信・与える',
    body: '自分は特別な人間である。実際今までいろんなことを成し遂げてきたし、これからも成し遂げ続ける。人を常に助け、いろんな人に与える。2028年以内に売上50.5億円・EBITDA14.5億円を達成している。',
  },
  {
    title: '② 必笑思考',
    body: '私は必ず勝ち、問題を解決し、高みに登り続ける。どんな時も楽しめ、笑え、笑わせろ。恥やプライドを捨て、成功の姿を鮮明にイメージする。',
  },
  {
    title: '③ 豪運と運命',
    body: '私は世界一運が良く、大成功を運命づけられている。今起きているトラブルさえ成功の布石だ。これまでの人生も素晴らしかった。これからさらに素晴らしくなる。',
  },
  {
    title: '④ 努力と徳分',
    body: '努力を怠らず、人に与え続けて徳を積む。常に高い志を持ち、もっと大きく暴れろ。一日一善を実践し、人が何を欲しているか考え続ける。',
  },
  {
    title: '⑤ 超感謝',
    body: '仏陀が与えてくださったこの状況は最高の富を得るための環境であり、それを理解し感謝する。今まで関わった良い人悪い人関わらず全員に感謝する。',
  },
];

// ---------- §1-5 心得ライブラリ(1項目=1文) ----------

export interface SeedPrinciple {
  category: string;
  text: string;
}

export const PRINCIPLE_CATEGORIES = [
  'NASH最上位',
  'NASH上位思考',
  'NASH常態思考',
  'Philosophy',
  'CEOの8つの仕事',
  '経営の法則',
  'ジャックマー',
  '成功法則',
  '成功の習慣',
  'ダルマの法則',
  '強み',
  '弱み',
  'やりたくないこと',
] as const;

export const PRINCIPLES: SeedPrinciple[] = [
  // NASH思考体系 — 最上位
  { category: 'NASH最上位', text: '必笑思考: どんな時も楽しめ、笑え、笑わせろ。' },
  { category: 'NASH最上位', text: '本質力(CQ): 最上位指標は本質力である。磨き続けよ。' },
  // NASH思考体系 — 上位思考
  { category: 'NASH上位思考', text: '直視思考: 不都合な真実から目を逸らすな。' },
  { category: 'NASH上位思考', text: '目的思考: 手段と目的を混同するな。情報の波の中で目的を見失うな。' },
  { category: 'NASH上位思考', text: '継承思考: その大事さを、次の世代に継承せよ。自らの分身を作って組織を強固に。' },
  // NASH思考体系 — 常態思考
  { category: 'NASH常態思考', text: '未来思考: 今日明日のことばかり考えるな。長い目で考えろ。' },
  { category: 'NASH常態思考', text: '当事者思考: 起こった全ての事象は、自分の責任である。' },
  { category: 'NASH常態思考', text: '超感謝思考: 感謝万象。今の自分を形作った全てに感謝せよ。' },
  { category: 'NASH常態思考', text: 'スポンジ思考: 自分より本質力の高い人から、どんな時も学び続けよ。' },
  { category: 'NASH常態思考', text: '勝利思考: 徹底的に勝ちにこだわれ。2位以下はおしなべて敗者である。' },
  { category: 'NASH常態思考', text: '複利思考: 毎日の小さな積み重ねが運命を変える。' },
  // Philosophy
  { category: 'Philosophy', text: '人を幸せにするために、自分たちが幸せであれ。' },
  { category: 'Philosophy', text: '変化を恐れるな。変化を楽しめ。' },
  { category: 'Philosophy', text: 'やりきる。やりきった先に、未来はある。' },
  { category: 'Philosophy', text: '仲間を信じ、仲間に尽くす。' },
  { category: 'Philosophy', text: '仕事も遊びも、本気で取り組む。' },
  // CEOの8つの仕事
  { category: 'CEOの8つの仕事', text: '自分より視座が高い人と会う。' },
  { category: 'CEOの8つの仕事', text: '大きな数字に触れる。' },
  { category: 'CEOの8つの仕事', text: '大きな問題を扱う。' },
  { category: 'CEOの8つの仕事', text: '死を意識する。' },
  { category: 'CEOの8つの仕事', text: '圧倒的な自然・芸術に触れる。' },
  { category: 'CEOの8つの仕事', text: '毎朝Visionを確認する。' },
  { category: 'CEOの8つの仕事', text: '下を見ない・関わらない。' },
  { category: 'CEOの8つの仕事', text: '瞑想する。' },
  // 経営の法則
  { category: '経営の法則', text: '企業の実力は、個の実力(質)×人数(量)×マネー(量)×システム(効率)で決まる。' },
  { category: '経営の法則', text: '思考のミスは「長期⇄短期」「手段⇄目的」のどちらかがズレている。' },
  { category: '経営の法則', text: '社長の仕事は、資金調達・プロジェクト管理・新規事業開発・徳を積む・値決め・報酬設定である。' },
  { category: '経営の法則', text: '信用は複利で増えていく。BSに乗らないが最も大事な資産である。' },
  { category: '経営の法則', text: 'マーケティングで最も大事なのは、センターピンを決めることである。' },
  { category: '経営の法則', text: '人材育成で最も大事なのは、経営者がノンガターレーンを意識することである。' },
  { category: '経営の法則', text: '人・金・情報で何が足りないかを常に考えて、すぐに補え。' },
  { category: '経営の法則', text: '安く手に入れて、高くで売る。これが鉄則である。' },
  // ジャックマー
  { category: 'ジャックマー', text: '金は人には付いて行かない。夢に付いていく。だから夢を追いかけるんだ。' },
  { category: 'ジャックマー', text: '他人の成功話は無視しろ。失敗談をよく聞け。そこに答えがある。' },
  { category: 'ジャックマー', text: '器のデカさは味わった屈辱の量で決まる。' },
  { category: 'ジャックマー', text: 'ダメな部下などいない、ダメなリーダーがいるだけだ。' },
  { category: 'ジャックマー', text: '文句は暇なヤツに言わせておけ。賢いヤツはその文句にチャンスがあることを知っている。' },
  { category: 'ジャックマー', text: '自分の信念を貫け。ミスしたっていい。失敗から得られるものは人生の宝だ。' },
  // 成功法則
  { category: '成功法則', text: '幸せとは今を感じる心の状態。成功とは思い描く未来の状態。' },
  { category: '成功法則', text: '恥やプライドが最も良くない。これが無ければ全てを実現できる。' },
  { category: '成功法則', text: '人は驕りで破滅する。' },
  { category: '成功法則', text: '悪い結果になった時にボラティリティが発生して、チャンスが出現する。' },
  { category: '成功法則', text: '完璧を目指さない。' },
  { category: '成功法則', text: '家族を大切にする。稼いだ金を有効に使う。' },
  { category: '成功法則', text: '迷ったら、過去現在のいい面悪い面の4面分析をせよ。' },
  // 成功の習慣
  { category: '成功の習慣', text: '瞑想' },
  { category: '成功の習慣', text: 'ジャーナリング' },
  { category: '成功の習慣', text: '明晰夢' },
  { category: '成功の習慣', text: '自律訓練法' },
  { category: '成功の習慣', text: 'デジタルデトックス' },
  { category: '成功の習慣', text: '運動(筋トレ・有酸素)' },
  { category: '成功の習慣', text: 'ネットワーキング(週2回新しい出会い)' },
  { category: '成功の習慣', text: 'コールドシャワー' },
  { category: '成功の習慣', text: 'とにかく大きいスケールで考える' },
  // ダルマの法則
  { category: 'ダルマの法則', text: '瞑想せよ。前頭葉と海馬を鍛え、JITを覚醒させる。' },
  { category: 'ダルマの法則', text: '徳分を積め。一日一善。徳分の大きさは相手の感謝の大きさである。' },
  { category: 'ダルマの法則', text: '本質を見抜け。執着をなくせ。' },
  { category: 'ダルマの法則', text: '利他心を強めよ。与え、貢献せよ。' },
  { category: 'ダルマの法則', text: '感情をコントロールせよ。' },
  { category: 'ダルマの法則', text: '姿勢をよくせよ。' },
  { category: 'ダルマの法則', text: '仏法を学べ。' },
  { category: 'ダルマの法則', text: '正見: 物事を正しく理解する。' },
  { category: 'ダルマの法則', text: '正思惟: 世俗の価値観にとらわれず、正しくありのままに考える。' },
  { category: 'ダルマの法則', text: '正語: ウソ、悪口、陰口は言わない。' },
  { category: 'ダルマの法則', text: '正業: 殺生、盗みをしない。' },
  { category: 'ダルマの法則', text: '正命: 社会を良くしていく仕事に就き、自分に対して正直に生きる。' },
  { category: 'ダルマの法則', text: '正精進: 常にポジティブに生き成長していく。' },
  { category: 'ダルマの法則', text: '正念: 現実を受け入れ、思慮深くある。' },
  { category: 'ダルマの法則', text: '正定: 瞑想し、正見を深める。' },
  { category: 'ダルマの法則', text: '母親が喜ぶことをする。' },
  { category: 'ダルマの法則', text: '風水を整えよ。' },
  { category: 'ダルマの法則', text: 'プジャに参加せよ。' },
  { category: 'ダルマの法則', text: 'ベジタリアンを目指せ(長期方向。今は事業を優先し、稼いで守る)。' },
  // 自己認識 — 強み
  { category: '強み', text: '圧倒的な人心掌握力と天性のリーダーシップが、私の武器である。' },
  { category: '強み', text: '強い直感力と戦略的思考で、新しい事業を考え実行に移せる。' },
  { category: '強み', text: '楽観的で、ストレス耐性と精神的タフさが高い。' },
  { category: '強み', text: '承認欲求を強力な成功エネルギーに変える力がある。' },
  { category: '強み', text: '卓越した豪運を持っている。' },
  // 自己認識 — 弱み(アプリに管理を委託する理由)
  { category: '弱み', text: '期限や競争がないと、モチベーションを維持しにくい。' },
  { category: '弱み', text: '成果や期限が曖昧なタスクには集中できない。' },
  { category: '弱み', text: '自分が設定したルールを守る自己コントロールが弱い。' },
  { category: '弱み', text: '自由すぎる環境にいると怠惰に陥りやすい。' },
  // 自己認識 — やりたくないこと
  { category: 'やりたくないこと', text: 'お金の心配。細かい事務作業。' },
  { category: 'やりたくないこと', text: '人を馬鹿にしたり、見下すこと。' },
  { category: 'やりたくないこと', text: '安い座席に乗ること。時間に縛られること。' },
];

// ---------- §2 体 BODY ----------

export const BODY_HABITS = [
  { key: 'body_meditation', label: '瞑想', note: 'JITを覚醒させる' },
  { key: 'body_diet', label: '食事管理', note: 'JITを綺麗に' },
  { key: 'body_training', label: '筋トレ', note: 'カルマ解消の練習' },
] as const;

export const SLEEP_RULES = [
  '二度寝絶対禁止(2時間はあける)',
  '起床時間の固定(恒久ルール)',
  '睡眠記録',
  '起床時と帰宅直後にストレッチ',
  'パワーナップ15分以内を毎日2〜3回',
  '3日やって1日休暇制(日中1.5時間)',
  '入眠前ストレッチ',
] as const;

export const HEALTH_TARGETS_2026 =
  '筋トレ年180回/有酸素年180回/体脂肪率10%未満(9月中旬13〜15%を中間マイルストーン)/BIG3 450kg(ベンチ120・スクワット150・デッド180)/年間瞑想1万分/年間400万歩/風邪は年1回まで/水2L毎日/BCG注射3回以上/ブドウサプリ毎日';

// ---------- §3-1 KGI(コミット/ストレッチ二段構造) ----------

export interface SeedKpi {
  label: string;
  commit: number;
  stretch: number | null;
  unit: string;
  deadline: string;
  linkedCondition: string | null;
}

export const KPIS: SeedKpi[] = [
  { label: 'グループ売上', commit: 17.2, stretch: 30, unit: '億円', deadline: '2026-12-31', linkedCondition: null },
  { label: 'EBITDA', commit: 1.6, stretch: 5, unit: '億円', deadline: '2026-12-31', linkedCondition: null },
  { label: 'グループ現預金', commit: 10, stretch: null, unit: '億円', deadline: '2026-12-31', linkedCondition: '新城島売却成約に連動' },
  { label: 'ラティーダ資金調達', commit: 18, stretch: null, unit: '億円', deadline: '2026-12-31', linkedCondition: null },
  { label: '個人資産', commit: 3, stretch: null, unit: '億円', deadline: '2026-12-31', linkedCondition: '新城島売却成約に連動' },
];

/** 売上17.2億の内訳(参照表示用) */
export const REVENUE_BREAKDOWN =
  'マリン9億/OTA2.2億/与那国2.5億/飲食3.5億(KANIZA1.5・USHIGAKI石垣1・セントエルモ1)→長期借入金13億';

// ---------- §3-5 2026年クエスト ----------
// ※原本の体験カテゴリは28件と記載されているが「ほか」で省略されており、記載済み17件のみ収録。

export interface SeedQuest {
  category: string;
  title: string;
  done?: boolean;
}

export const QUEST_CATEGORIES = ['仕事', '家族友人', '体験', 'スキル'] as const;

/** 体験カテゴリは「コントロールの上でのご褒美枠」 */
export const QUEST_REWARD_CATEGORY = '体験';

export const QUESTS: SeedQuest[] = [
  // 仕事(21)
  { category: '仕事', title: '売上17.2億(KGI)' },
  { category: '仕事', title: 'EBITDA1.6億(KGI)' },
  { category: '仕事', title: '西表島新設ホテル18億調達' },
  { category: '仕事', title: '新城島売却35億以上' },
  { category: '仕事', title: 'むんぶ売却3億以上' },
  { category: '仕事', title: '現預金10億' },
  { category: '仕事', title: '竹富島スタート' },
  { category: '仕事', title: '安栄観光買う' },
  { category: '仕事', title: 'ニセコアミューズメントカジノ' },
  { category: '仕事', title: '海外飲食進出(にぼ次郎レシピ)' },
  { category: '仕事', title: '明石食堂買う' },
  { category: '仕事', title: '土木関連企業買う' },
  { category: '仕事', title: '運転資金5億調達' },
  { category: '仕事', title: '役員旅行', done: true },
  { category: '仕事', title: 'ドリーム観光買う' },
  { category: '仕事', title: '役員ボーナス全員1,000万以上' },
  { category: '仕事', title: '新規事業', done: true },
  { category: '仕事', title: '人材派遣会社買う' },
  { category: '仕事', title: 'エネルギー・廃棄物企業買う' },
  { category: '仕事', title: '個人資産3億以上' },
  { category: '仕事', title: '石垣島で高級焼肉店開業' },
  // 家族・友人(10)
  { category: '家族友人', title: '家族だけ旅行年2+' },
  { category: '家族友人', title: '藤原家との旅行年2+' },
  { category: '家族友人', title: '親戚旅行年1+' },
  { category: '家族友人', title: 'おかん旅行年1+' },
  { category: '家族友人', title: '旅行く部年1+' },
  { category: '家族友人', title: '紫汐に習い事' },
  { category: '家族友人', title: '家族時間を去年より増やす' },
  { category: '家族友人', title: '愛美54kg' },
  { category: '家族友人', title: '愛美に英語' },
  { category: '家族友人', title: '帰国後第二子' },
  // 体験(28・ご褒美枠)
  { category: '体験', title: '加賀先生のアドバイスを全て実行する' },
  { category: '体験', title: 'ロサンゼルスの同じ家に75泊する' },
  { category: '体験', title: '福島に宿泊' },
  { category: '体験', title: '秋田に宿泊' },
  { category: '体験', title: '岩手に宿泊' },
  { category: '体験', title: '長崎に宿泊' },
  { category: '体験', title: '島根に宿泊' },
  { category: '体験', title: '愛媛に宿泊' },
  { category: '体験', title: '埼玉に宿泊' },
  { category: '体験', title: '岡山に宿泊' },
  { category: '体験', title: '山口に宿泊' },
  { category: '体験', title: '大分に宿泊' },
  { category: '体験', title: '中国滞在' },
  { category: '体験', title: 'モンゴル滞在' },
  { category: '体験', title: 'アフリカ滞在' },
  { category: '体験', title: 'ドバイ滞在' },
  { category: '体験', title: 'スペイン滞在' },
  { category: '体験', title: 'フランス滞在' },
  { category: '体験', title: 'クロアチア滞在' },
  { category: '体験', title: '未踏ヨーロッパ5カ国滞在' },
  { category: '体験', title: 'カナダ滞在' },
  { category: '体験', title: 'キューバ滞在' },
  { category: '体験', title: 'バリ島再訪' },
  { category: '体験', title: '海外のポーカーで100万勝つ' },
  { category: '体験', title: '竹ふえ泊まる' },
  { category: '体験', title: 'W杯決勝見る' },
  { category: '体験', title: 'ロサンゼルスの自宅に女7人呼ぶ' },
  { category: '体験', title: 'ラスベガスのスフィアに行く' },
  // スキル(2)
  { category: 'スキル', title: '英語力B2' },
  { category: 'スキル', title: '良書30冊' },
];

// ---------- §4-1 ロードマップ ----------

export interface RoadmapItem {
  year: number;
  age: number;
  rev: string;
  ebitda: string;
  note: string;
}

export const ROADMAP: RoadmapItem[] = [
  { year: 2026, age: 32, rev: '17.2億', ebitda: '1.6億', note: '内訳: マリン9億・OTA2.2億・ホテル2.5億・飲食3.5億 / 長期借入13億' },
  { year: 2027, age: 33, rev: '32.5億', ebitda: '7.5億', note: '内訳: マリン10億・OTA3億・ホテル3億・飲食11.5億・その他5億 / 借入16億' },
  { year: 2028, age: 34, rev: '50.5億', ebitda: '14.5億', note: '内訳: マリン11億・OTA3億・ホテル11億・飲食16.5億・その他9億 / 借入26億' },
  { year: 2029, age: 35, rev: '95億', ebitda: '29億', note: '中型M&A・沖縄本島ビーチクラブ開業(調達40〜50億)' },
  { year: 2030, age: 36, rev: '150億', ebitda: '47億', note: 'USHIGAKIミシュラン・Latida国際建築賞・FC展開パイロット' },
  { year: 2031, age: 37, rev: '220億', ebitda: '70億', note: 'PE調達300〜500億・アセットライト本格展開' },
  { year: 2032, age: 38, rev: '320億', ebitda: '130億', note: '' },
  { year: 2033, age: 39, rev: '450億', ebitda: '200億', note: 'IPO準備完了・欧米進出' },
  { year: 2034, age: 40, rev: '550億', ebitda: '270億', note: '時価総額6,500億円・IPO — そして1兆円へ' },
];

export const ROADMAP_STRATEGY = '基本戦略: ①直営でブランド磨き込み ②AI省人化 ③アセットライト転換';

// ---------- §4-2 人生の到達点 ----------

export const LIFE_GOALS = [
  '高級車10台(総額10億円)/高級時計10本(資産価値3億円)',
  '東京・大阪・沖縄・北海道・アメリカ・ハワイ等に豪邸(総額100億・資産価値200億)',
  'ビジネスジェット所有(移動は基本ジェット・購入10億・ランニング3億/年)',
  '毎月使える自由なお金3億円(イニシャル総額200億・ランニング5億/月)',
] as const;

// ---------- 上映シーン(ロードマップ主要年+人生の到達点。数字は必ずストレッチ側) ----------

export interface SeedScene {
  tag: string;
  numberText: string;
  caption: string;
  body: string;
  /** グラデーション(開始色,中間色,終了色) */
  gradient: [string, string, string];
}

export const SCENES: SeedScene[] = [
  {
    tag: '2026',
    numberText: '30億',
    caption: 'グループ売上',
    body: '2026年12月。NASHグループは売上30億円・EBITDA5億円を達成している。',
    gradient: ['#0A1E2E', '#14405C', '#2E7196'],
  },
  {
    tag: 'SHINJO ISLAND',
    numberText: '成約',
    caption: '新城島',
    body: '新城島の売買は成約した。竹富島で、新しい事業が動き出している。',
    gradient: ['#04293A', '#0B5E5A', '#2FA69A'],
  },
  {
    tag: '2028',
    numberText: '50.5億',
    caption: '売上 / EBITDA 14.5億',
    body: '2028年。売上50.5億円・EBITDA14.5億円を達成している。',
    gradient: ['#0B1E33', '#1C3F63', '#3E6E9E'],
  },
  {
    tag: '2029',
    numberText: '95億',
    caption: '売上 / EBITDA 29億',
    body: '沖縄本島のビーチクラブが開業し、中型M&Aを実行している。',
    gradient: ['#101A2C', '#25486E', '#5B84B1'],
  },
  {
    tag: '2030',
    numberText: '★',
    caption: 'USHIGAKI ミシュラン獲得',
    body: 'USHIGAKIはミシュランを獲得し、Latidaは国際建築賞に輝いている。',
    gradient: ['#1C1230', '#3A2A5E', '#7A5EA8'],
  },
  {
    tag: 'PRIVATE JET',
    numberText: '10,000m',
    caption: '移動は基本ビジネスジェット',
    body: '眼下に八重山の海。ジェットで世界を移動している。',
    gradient: ['#0E1B2E', '#1F4E6B', '#87B7D4'],
  },
  {
    tag: '2034 IPO',
    numberText: '6,500億',
    caption: '時価総額',
    body: '2034年。東証の鐘を鳴らしている。離島から来た男が、1兆円へ王手をかけている。',
    gradient: ['#1A0F0A', '#4A2A14', '#C9A961'],
  },
];

// ---------- 期限 ----------

export const DEADLINE_2026 = '2026-12-31';
export const DEADLINE_IPO = '2034-12-31';
