import type { EventDef } from '../../core/types';

// ※ すべて仮データ（placeholder: true）。本番の文章・数値・人物は ChatGPT 本部の指示で差し替える。
// 形式: 選択肢ごとに複数の結果（重み付き抽選）を持つ。effect は増減値。
const list: EventDef[] = [
  // ---- 社交（ルーフトップバー）----
  {
    id: 'ev_social_01', category: 'social', placeholder: true, characterId: 'socialite',
    title: '夜景のルーフトップ', text: '地上60階のバーで、街の有力者たちが集まっている。',
    choices: [
      { id: 'toast', label: '全員に乾杯をおごる', requiresMoney: 30_000, aiWeight: 1, outcomes: [
        { weight: 3, text: '一気に顔が売れた。名刺が次々と集まる。', effect: { money: -30_000, network: 8, fame: 3 } },
        { weight: 1, text: '盛り上がったが、誰も覚えていなかった。', effect: { money: -30_000, happiness: 3 } },
      ] },
      { id: 'watch', label: '静かに夜景を楽しむ', aiWeight: 1, outcomes: [
        { weight: 1, text: '贅沢な時間で心が満たされた。', effect: { happiness: 5 } },
      ] },
    ],
  },
  {
    id: 'ev_social_02', category: 'social', placeholder: true, characterId: 'investor',
    title: '投資家の誘い', text: '隣の席の投資家が、ある話を持ちかけてきた。',
    choices: [
      { id: 'listen', label: '話を聞く', aiWeight: 2, outcomes: [
        { weight: 2, text: '有益な情報を得た。', effect: { network: 6, money: 20_000 } },
        { weight: 1, text: 'ただの自慢話だった。', effect: { happiness: -3 } },
      ] },
      { id: 'decline', label: '丁重に断る', aiWeight: 1, outcomes: [
        { weight: 1, text: '品のある対応が評判になった。', effect: { fame: 2 } },
      ] },
    ],
  },
  // ---- 恋愛 ----
  {
    id: 'ev_romance_01', category: 'romance', placeholder: true, characterId: 'muse',
    title: '運命の出会い', text: 'サイアムの雑踏で、目を奪われる人と視線が重なった。',
    choices: [
      { id: 'dinner', label: '高級ディナーに誘う', requiresMoney: 50_000, aiWeight: 2, outcomes: [
        { weight: 3, text: '最高の夜になった。', effect: { money: -50_000, happiness: 12 } },
        { weight: 1, text: '話が弾まず、気まずい沈黙…。', effect: { money: -50_000, happiness: -4 } },
      ] },
      { id: 'smile', label: '微笑んで立ち去る', aiWeight: 1, outcomes: [
        { weight: 1, text: 'ほのかな余韻が残った。', effect: { happiness: 3 } },
      ] },
    ],
  },
  {
    id: 'ev_romance_02', category: 'romance', placeholder: true, characterId: 'muse',
    title: '突然のプレゼント', text: '恋人が限定ブランドのバッグを欲しがっている。',
    choices: [
      { id: 'buy', label: '買ってあげる', requiresMoney: 80_000, aiWeight: 1, outcomes: [
        { weight: 1, text: '最高の笑顔が見られた。', effect: { money: -80_000, happiness: 15, fame: 2 } },
      ] },
      { id: 'later', label: '今度ね、とかわす', aiWeight: 1, outcomes: [
        { weight: 1, text: '少し機嫌を損ねてしまった。', effect: { happiness: -6 } },
      ] },
    ],
  },
  // ---- 運命 ----
  {
    id: 'ev_fate_01', category: 'fate', placeholder: true, characterId: 'oracle',
    title: '占い師の予言', text: '路地裏の占い師が「今日は運命の日」と告げる。',
    choices: [
      { id: 'believe', label: '予言を信じる', aiWeight: 1, outcomes: [
        { weight: 1, text: '思わぬ臨時収入！', effect: { money: 120_000 } },
        { weight: 1, text: '財布を落とした…。', effect: { money: -60_000 } },
        { weight: 1, text: '何も起きなかった。', effect: { happiness: 1 } },
      ] },
      { id: 'ignore', label: '気にしない', aiWeight: 1, outcomes: [
        { weight: 1, text: '平穏な一日。', effect: { happiness: 2 } },
      ] },
    ],
  },
  {
    id: 'ev_fate_02', category: 'fate', placeholder: true,
    title: '突然のスコール', text: '激しい雨。タクシーが一台だけ止まった。',
    choices: [
      { id: 'share', label: '見知らぬ人と相乗りする', aiWeight: 1, outcomes: [
        { weight: 2, text: '相手は大企業の役員だった！', effect: { network: 10 } },
        { weight: 1, text: '気まずいまま到着した。', effect: { happiness: -2 } },
      ] },
      { id: 'wait', label: '雨宿りして待つ', aiWeight: 1, outcomes: [
        { weight: 1, text: '虹が見えた。', effect: { happiness: 4 } },
      ] },
    ],
  },
  // ---- VIP ----
  {
    id: 'ev_vip_01', category: 'vip', placeholder: true, characterId: 'host',
    title: 'VIPルームへの招待', text: '会員制クラブの最上階。シャンパンタワーが輝く。',
    choices: [
      { id: 'tower', label: 'シャンパンタワーを入れる', requiresMoney: 100_000, aiWeight: 1, outcomes: [
        { weight: 1, text: '店中の注目を集めた！', effect: { money: -100_000, fame: 12, network: 5 } },
      ] },
      { id: 'drink', label: '一杯だけ楽しむ', aiWeight: 2, outcomes: [
        { weight: 1, text: '上質な時間を過ごした。', effect: { money: -10_000, happiness: 5 } },
      ] },
    ],
  },
  {
    id: 'ev_vip_02', category: 'vip', placeholder: true, characterId: 'celebrity',
    title: 'セレブとの写真', text: '有名人が同じフロアにいる。',
    choices: [
      { id: 'photo', label: '一緒に写真を撮る', aiWeight: 2, outcomes: [
        { weight: 2, text: 'SNSでバズった！', effect: { fame: 10 } },
        { weight: 1, text: 'ボディガードに止められた。', effect: { fame: -3, happiness: -2 } },
      ] },
      { id: 'skip', label: '遠くから眺める', aiWeight: 1, outcomes: [
        { weight: 1, text: '今夜の話のネタができた。', effect: { happiness: 2 } },
      ] },
    ],
  },
  // ---- 商談 ----
  {
    id: 'ev_business_01', category: 'business', placeholder: true, characterId: 'investor',
    title: '新規事業の提案', text: 'スタートアップへの出資話。成功すれば大きなリターン。',
    choices: [
      { id: 'invest', label: '$200K 出資する', requiresMoney: 200_000, aiWeight: 1, outcomes: [
        { weight: 2, text: '事業が成功！ 配当を受け取った。', effect: { money: 200_000, network: 5 } },
        { weight: 2, text: '事業は失敗。出資金は戻らない。', effect: { money: -200_000 } },
      ] },
      { id: 'pass', label: '見送る', aiWeight: 1, outcomes: [
        { weight: 1, text: '慎重な判断も大切だ。', effect: {} },
      ] },
    ],
  },
  {
    id: 'ev_business_02', category: 'business', placeholder: true,
    title: '銀行の融資', text: '銀行が低金利の融資を提案してきた。',
    choices: [
      { id: 'loan', label: '$300K を借りる', aiWeight: 1, outcomes: [
        { weight: 1, text: '手元資金が増えた。返済は計画的に。', effect: { money: 300_000, debt: 330_000 } },
      ] },
      { id: 'no', label: '借りない', aiWeight: 2, outcomes: [
        { weight: 1, text: '身軽なままでいることにした。', effect: {} },
      ] },
    ],
  },
  // ---- スキャンダル ----
  {
    id: 'ev_scandal_01', category: 'scandal', placeholder: true, characterId: 'reporter',
    title: '週刊誌の記者', text: '昨夜の行動を撮られていたらしい…。',
    choices: [
      { id: 'pay', label: '口止め料を払う', requiresMoney: 70_000, aiWeight: 1, outcomes: [
        { weight: 3, text: '記事は出なかった。', effect: { money: -70_000 } },
        { weight: 1, text: '払ったのに記事が出た！', effect: { money: -70_000, fame: -10 } },
      ] },
      { id: 'deny', label: '堂々と否定する', aiWeight: 1, outcomes: [
        { weight: 1, text: '誠実さが評価された。', effect: { fame: 4 } },
        { weight: 1, text: '炎上してしまった。', effect: { fame: -8, happiness: -5 } },
      ] },
    ],
  },
  {
    id: 'ev_scandal_02', category: 'scandal', placeholder: true,
    title: '噂話', text: 'あなたに関する噂がシーロム中に広まっている。',
    choices: [
      { id: 'party', label: 'パーティーを開いて払拭', requiresMoney: 60_000, aiWeight: 1, outcomes: [
        { weight: 1, text: '噂は笑い話に変わった。', effect: { money: -60_000, fame: 5, network: 3 } },
      ] },
      { id: 'ignore', label: '放っておく', aiWeight: 1, outcomes: [
        { weight: 1, text: '少し評判が下がった。', effect: { fame: -5 } },
      ] },
    ],
  },
  // ---- 大富豪パーティー ----
  {
    id: 'ev_party_01', category: 'party', placeholder: true, characterId: 'tycoon',
    title: '大富豪のヨットパーティー', text: 'チャオプラヤー川に浮かぶ豪華ヨット。世界の富豪が集う。',
    choices: [
      { id: 'network', label: '富豪たちと交流する', aiWeight: 2, outcomes: [
        { weight: 1, text: '大物とのつながりができた。', effect: { network: 12, fame: 4 } },
      ] },
      { id: 'dance', label: '夜通し踊る', aiWeight: 1, outcomes: [
        { weight: 1, text: '人生最高の夜！', effect: { happiness: 12 } },
      ] },
    ],
  },
  {
    id: 'ev_party_02', category: 'party', placeholder: true, characterId: 'tycoon',
    title: 'チャリティーオークション', text: '慈善オークションに一流の品が並ぶ。',
    choices: [
      { id: 'bid', label: '$150K で落札する', requiresMoney: 150_000, aiWeight: 1, outcomes: [
        { weight: 1, text: '社交界で称賛を浴びた。', effect: { money: -150_000, fame: 15, happiness: 5 } },
      ] },
      { id: 'clap', label: '拍手を送る', aiWeight: 2, outcomes: [
        { weight: 1, text: '楽しいひとときだった。', effect: { happiness: 3 } },
      ] },
    ],
  },
  // ---- 運命の大勝負 ----
  {
    id: 'ev_bigfate_01', category: 'bigfate', placeholder: true, characterId: 'dealer',
    title: '運命の大勝負', text: '伝説のディーラーが微笑む。「すべてを賭けますか？」',
    choices: [
      { id: 'allin', label: '$300K を賭ける', requiresMoney: 300_000, aiWeight: 1, outcomes: [
        { weight: 1, text: '大勝利！ 賭け金が3倍に！', effect: { money: 600_000, fame: 8 } },
        { weight: 2, text: '惨敗…。すべてを失った。', effect: { money: -300_000, happiness: -8 } },
      ] },
      { id: 'small', label: '$50K だけ賭ける', requiresMoney: 50_000, aiWeight: 2, outcomes: [
        { weight: 1, text: '勝った！', effect: { money: 50_000, happiness: 3 } },
        { weight: 1, text: '負けた。', effect: { money: -50_000 } },
      ] },
      { id: 'leave', label: '立ち去る', aiWeight: 1, outcomes: [
        { weight: 1, text: '勝負しない勇気もある。', effect: {} },
      ] },
    ],
  },
  {
    id: 'ev_bigfate_02', category: 'bigfate', placeholder: true, characterId: 'dealer',
    title: '黄金のルーレット', text: '一晩限りの特別なルーレットが回り始めた。',
    choices: [
      { id: 'red', label: '赤に賭ける ($100K)', requiresMoney: 100_000, aiWeight: 1, outcomes: [
        { weight: 1, text: '赤！ 倍になった。', effect: { money: 100_000 } },
        { weight: 1, text: '黒…。', effect: { money: -100_000 } },
      ] },
      { id: 'gold', label: '金色の0に賭ける ($100K)', requiresMoney: 100_000, aiWeight: 0.3, outcomes: [
        { weight: 1, text: '奇跡の0！ 10倍だ！', effect: { money: 1_000_000, fame: 15 } },
        { weight: 9, text: '外れ…。', effect: { money: -100_000 } },
      ] },
      { id: 'leave', label: '見るだけにする', aiWeight: 1, outcomes: [
        { weight: 1, text: '観客として楽しんだ。', effect: { happiness: 2 } },
      ] },
    ],
  },
];

export const bangkokEvents: Record<string, EventDef> = Object.fromEntries(list.map((e) => [e.id, e]));
