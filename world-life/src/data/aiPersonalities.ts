// AIライバルの個性（暫定。名前・性格・セリフは本部の指示で差し替え可能）
export interface AiPersonality {
  /** 肩書き（HUDなどに表示） */
  title: string;
  /** 空き物件購入後に手元へ残したい最低資金 */
  cashReserve: number;
  /** 買収を仕掛ける確率（0〜1） */
  buyoutChance: number;
  /** 買収後に手元へ残したい最低資金 */
  buyoutReserve: number;
  /** 近道の好み（-1 通常ルート派 〜 +1 近道派） */
  shortcutBias: number;
  /** イベント選択の価値観（大きいほど重視。risk は正ならハイリスク好き） */
  values: { money: number; fame: number; network: number; happiness: number; risk: number };
  /** セリフ */
  lines: { buy: string[]; buyout: string[]; boughtOut: string[]; bigWin: string[]; bigLoss: string[] };
}

export const AI_PERSONALITIES: Record<string, AiPersonality> = {
  // レオン：攻めの投資家。物件を買い漁り、買収も積極的
  p2: {
    title: '攻めの投資家',
    cashReserve: 60_000,
    buyoutChance: 0.75,
    buyoutReserve: 120_000,
    shortcutBias: -0.4,
    values: { money: 1.4, fame: 0.5, network: 0.6, happiness: 0.3, risk: 0.1 },
    lines: {
      buy: ['いい物件だ。いただくよ。', 'この街の価値は俺が決める。', '投資は早い者勝ちさ。'],
      buyout: ['悪いね、この物件は俺がもらう。', '値段がつくものは、全部買える。', '君の物件、高く買ってあげよう。'],
      boughtOut: ['…覚えておけよ。', 'ふん、高値で売れたなら悪くない。'],
      bigWin: ['計算どおりだ。'],
      bigLoss: ['想定外だな…。'],
    },
  },
  // ミラ：社交界の華。名声と人脈を重視し、物件は慎重
  p3: {
    title: '社交界の華',
    cashReserve: 250_000,
    buyoutChance: 0.2,
    buyoutReserve: 300_000,
    shortcutBias: 0,
    values: { money: 0.6, fame: 1.4, network: 1.3, happiness: 1.0, risk: -0.3 },
    lines: {
      buy: ['素敵な場所ね。私のものにするわ。', 'ここならパーティーが開けそう。'],
      buyout: ['ごめんなさい、どうしても欲しかったの。', 'この物件、私の方が似合うわ。'],
      boughtOut: ['あら、強引な人。', '次は渡さないわよ。'],
      bigWin: ['今夜は乾杯ね！'],
      bigLoss: ['…今日はついてないわ。'],
    },
  },
  // カイ：勝負師。近道と大勝負が好き
  p4: {
    title: '天性の勝負師',
    cashReserve: 120_000,
    buyoutChance: 0.45,
    buyoutReserve: 80_000,
    shortcutBias: 0.7,
    values: { money: 1.0, fame: 0.7, network: 0.4, happiness: 0.8, risk: 0.9 },
    lines: {
      buy: ['直感が買えって言ってる！', 'よし、ここに賭ける！'],
      buyout: ['勝負は奪ってナンボ！', 'いただき！'],
      boughtOut: ['やるじゃん！', 'まだまだこれから！'],
      bigWin: ['来た来た来たー！', 'これだから勝負はやめられない！'],
      bigLoss: ['くっ…次で取り返す！'],
    },
  },
};

export function personalityOf(playerId: string): AiPersonality | undefined {
  return AI_PERSONALITIES[playerId];
}
