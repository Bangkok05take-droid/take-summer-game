/* 第1章のチュートリアル（2026-11-25）。文言はここだけで直せる。話し手は SKIN.speakers.aide（ヴェイル）
 *
 * GUIDE（1-1）：上から順に1つずつ。
 *   wait：'tap'＝ゲームを止めて、タップで次へ／'summon'＝key の魔物を召喚したら次へ／'furnace'＝魔力炉を強化したら次へ／
 *         'spell'＝魔王の呪文を使ったら次へ／'time'＝sec 秒たったら次へ（止めない）
 *   focus：光らせる場所（CSS セレクタ）／enemy：この手順の始めに出す人間軍／spawner：true で敵の出現を始める
 *   prep：手順の始めに整えること（mana＝魔力をその量まで足す／spell＝呪文を満タンにする）
 * HINTS（1-2）：ゲームは止めず、上に数秒だけ出す。
 * LOSE_TIPS：負けたときの一言（1-2・1-3）。SELF_HINT：1-3 で2回以上負けたとき、偵察報告に足す一言 */
export const GUIDE = [
  { wait: 'tap', text: '大魔王様、いよいよ侵略の始まりです。右が我らの「封印の祠」、左の小屋が人間軍の拠点。あの拠点を壊せば勝ちです。' },
  { wait: 'summon', key: 'mass', focus: '.slot[data-key="mass"]', prep: { mana: 100 }, text: 'まずは魔物を呼びましょう。下の「グミ」を押してください。' },
  { wait: 'time', sec: 4, enemy: ['militia'], text: '呼んだ魔物は、自分で前へ進みます。左から人間が向かってきました。出会うと自動で戦います。' },
  { wait: 'tap', focus: '.manabox', text: '召喚には「魔力」を使います。魔力は時間とともにたまります。カードの数字が、その魔物の魔力です。' },
  { wait: 'summon', key: 'vanguard', focus: '.slot[data-key="vanguard"]', prep: { mana: 200 }, enemy: ['militia', 'militia'], text: '次は「闇の騎士」。打たれ強い前衛で、仲間の盾になります。' },
  { wait: 'furnace', focus: '#btnFurnace', prep: { mana: 160 }, text: '左下の「魔力炉」を強化すると、魔力の上限と、たまる速さが上がります。押してみてください。' },
  { wait: 'spell', focus: '#btnSpell', prep: { spell: true }, enemy: ['militia', 'militia', 'swordsman'], text: '右下の「魔王の呪文」がたまりました！ 押すと、人間が集まっている所をまとめて攻撃します。' },
  { wait: 'tap', spawner: true, text: 'お見事です。あとはご自由に。魔物を呼び続けて、見張り小屋を壊してください。（このステージでは祠は壊れません）' },
];

export const HINTS = {
  // 人間軍が初めて出たとき
  enemy: {
    militia: '自警団は数が多いけれど弱い相手。グミや魔法使いでまとめて倒しましょう。',
    swordsman: '見習い剣士は打たれ強い前衛。闇の騎士や岩男で受け止めましょう。',
    archer: '弓兵は後ろから矢を撃ちます。足の速い「こうもり」で近づくと効果的です。',
    priest: '僧侶が仲間を回復しています！ 後衛を狙う「木槌小鬼」なら、前衛を飛ばして直接ねらえます。',
    shield: '盾兵はとても硬い相手。魔法使いの範囲攻撃や、木槌小鬼の重い一撃が効きます。',
    rider: '騎兵は足が速く、一気に祠へ迫ります。前衛で足止めしましょう。',
  },
  furnace: { at: 25, text: '魔力炉はまだ Lv1 です。早めに強化すると、後がずっと楽になります。' },
  spell: '魔王の呪文がたまりました。敵が固まった所で使うと効果的です。',
};

// 1-2 の偵察と編成で、最初の1回だけ出す説明
export const SCREEN_TIPS = {
  recon: '戦う前に、こうして人間軍のようすをお伝えします。どんな敵がいるかを見て、出撃する魔物を選びましょう。',
  form: '出撃できるのは5体まで（大魔王様の力が戻ると増えます）。今回は回復役の僧侶がいるので、後衛を狙う木槌小鬼がおすすめです。',
};

export const LOSE_TIPS = {
  furnace: '魔力炉を強化しないと、魔力がすぐ足りなくなります。最初のうちに Lv2〜3 へ上げましょう。',
  few: '魔物が少なすぎたようです。魔力がたまったら、どんどん呼びましょう。',
  healer: '敵の回復役が残っていると、なかなか倒せません。木槌小鬼で後衛をねらいましょう。',
  default: '敵軍情報を見て、相手に合う魔物を編成してみましょう。',
};

export const SELF_HINT = 'ひとつだけ助言を。騎兵が来たら前衛で止め、盾兵には範囲攻撃を。魔力炉は早めに強化しましょう。';

/* 画面の手順つき説明（2026-11-25）。話し手はヴェイル。
 *   wait：'tap'＝説明の枠をタップで次へ／'click'＝target（CSSセレクタ）を押したら次へ（ほかのボタンは押せない）
 *   focus：光らせる場所（省略時は target）／at：説明の枠の位置（'top'｜'bottom'）／skipIf：(画面) => true ならとばす
 * FORM_GUIDE：1-2 の編成画面（最初の1回）／UPGRADE_GUIDE：1-2 をクリアしてステージ選択に戻ったとき（最初の1回） */
export const FORM_GUIDE = [
  { wait: 'tap', focus: '#formUnits', at: 'bottom', text: 'ここは出撃の編成です。上の段が、出撃する魔物。下の「控え」が、待っている魔物です。' },
  { wait: 'click', target: '#btnEnemyInfo', at: 'bottom', text: 'まずは「敵軍情報」で、相手を確かめましょう。' },
  { wait: 'click', target: '#btnEnemyClose', at: 'top', text: '回復役の「見習い僧侶」がいます。前の兵を倒しても、後ろから治されてしまいます。確かめたら「とじる」を。' },
  { wait: 'click', target: '#formUnits button.fcard:last-of-type', at: 'bottom', skipIf: () => !!document.querySelector('#formUnits .fcard[data-key="mallet"]'), text: '編成の魔物をタップすると、控えに外せます。右はしの魔物を外してみましょう。' },
  { wait: 'click', target: '#formPool .fcard[data-key="mallet"]', at: 'bottom', skipIf: () => !!document.querySelector('#formUnits .fcard[data-key="mallet"]'), text: '控えの「木槌小鬼」をタップして、編成に入れましょう。前の兵を飛びこえて、後ろの僧侶を直接ねらえます。' },
  { wait: 'tap', focus: '#formUnits .fslot.locked', at: 'bottom', text: '鍵のついた枠は、大魔王様の力が戻ると使えるようになります。編成は保存され、次のステージにも引き継がれます。' },
  { wait: 'click', target: '#btnSortie', at: 'top', text: '準備ができたら「出撃！」です。' },
];

export const UPGRADE_GUIDE = [
  { wait: 'click', target: '#btnUpgrade', at: 'top', text: '大魔王様、魔界石がたまってまいりました。「魔王軍を強化」で、軍を強くいたしましょう。' },
  { wait: 'tap', focus: '#upUnits', at: 'bottom', text: '左は「魔物」の強化です。魔界石でレベルを上げると、その魔物のHPと攻撃が上がります。' },
  { wait: 'click', target: '#upUnits button[data-unit="mass"]', at: 'bottom', skipIf: () => { const b = document.querySelector('#upUnits button[data-unit="mass"]'); return !b || b.disabled; }, text: 'グミのレベルを上げてみましょう。数で押す魔物なので、強くするとよく効きます。' },
  { wait: 'tap', focus: '#upGlobal', at: 'bottom', text: '右は「大魔王の力」です。支配力（編成の枠）はステージを制圧すると自動で戻り、魔力と魔王の力は魔界石で強化します。' },
  { wait: 'click', target: '#upGlobal button[data-up="manaMax"]', at: 'bottom', skipIf: () => { const b = document.querySelector('#upGlobal button[data-up="manaMax"]'); return !b || b.disabled; }, text: '「魔力の器」を強化すると、戦いを始めるときの最大魔力が増えます。押してみてください。' },
  { wait: 'tap', at: 'bottom', text: '戦闘中の「魔力炉」はその戦いの間だけ。ここでの強化は、ずっと続きます。魔界石はステージを制圧すると手に入ります。' },
];
