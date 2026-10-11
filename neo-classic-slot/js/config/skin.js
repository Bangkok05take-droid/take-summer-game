/*
 * 筐体スキン定義（正式デザイン: assets/design/reference_cabinet.jpg）
 *
 * すべての座標は「デザイン座標」= 1080 × 1920 px の筐体画像上の位置。
 * 画面サイズに関係なく、筐体全体をこの座標系ごと等倍縮小して表示するため、
 * 拡大・縮小してもパーツの位置はずれない。
 *
 * パーツ定義:
 *   rect   : [x, y, 幅, 高さ]（デザイン座標）
 *   z      : 重なり順（大きいほど手前）
 *   type   : image（画像を状態で切替）/ reels（リール描画領域）/ display（数字表示）/ effect（演出レイヤー）
 *   states : 状態名 → 画像ファイル（assets/images/ からの相対パス）。最初の状態が初期状態。
 *   hit    : タッチ判定を見た目より広げる量（px・デザイン座標）。スマホでの押しやすさ用。
 *   anim   : 状態切替時などに付与するアニメーション名（css/cabinet.css）
 *   label  : 画像が無い時のプレースホルダー表示名
 *   hidden : true なら初期状態で非表示（cab.setVisible で切替）
 *
 * 画像が未配置・読込失敗のパーツはプレースホルダー（半透明の枠＋名前）で表示される。
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  NCS.SKIN = {
    designWidth: 1080,
    designHeight: 1920,
    imageBase: 'assets/images/',
    reference: 'assets/design/reference_cabinet.jpg',

    parts: [
      // ---- ① 筐体背景 ----
      { id: 'cabinetBg', type: 'image', rect: [0, 0, 1080, 1920], z: 0, label: '筐体背景',
        states: { normal: 'cabinet/cabinet_bg.png' } },

      // ---- ② リール（3リールは1枚のcanvasに描画。リール間の隙間は背景が見える） ----
      { id: 'reels', type: 'reels', rect: [185, 570, 710, 380], z: 10, label: 'リール',
        reel: { width: 220, gap: 25, rows: 3 } },
      { id: 'reelFrame', type: 'image', rect: [145, 545, 790, 420], z: 20, label: 'リール枠', passThrough: true,
        states: { normal: 'cabinet/reel_frame.png' } },

      // ---- 有効ラインランプ（3・2・1）とステータスランプ ----
      { id: 'betLamp3', type: 'image', rect: [50, 535, 90, 105], z: 30, label: '3',
        states: { off: 'lamps/bet3_off.png', on: 'lamps/bet3_on.png' } },
      { id: 'betLamp2', type: 'image', rect: [50, 645, 90, 105], z: 30, label: '2',
        states: { off: 'lamps/bet2_off.png', on: 'lamps/bet2_on.png' } },
      { id: 'betLamp1', type: 'image', rect: [50, 755, 90, 105], z: 30, label: '1',
        states: { off: 'lamps/bet1_off.png', on: 'lamps/bet1_on.png' } },
      { id: 'lampStart', type: 'image', rect: [935, 555, 100, 75], z: 30, label: 'START',
        states: { off: 'lamps/start_off.png', on: 'lamps/start_on.png' } },
      { id: 'lampReplay', type: 'image', rect: [935, 672, 100, 75], z: 30, label: 'REPLAY',
        states: { off: 'lamps/replay_off.png', on: 'lamps/replay_on.png' } },
      { id: 'lampWait', type: 'image', rect: [935, 790, 100, 75], z: 30, label: 'WAIT',
        states: { off: 'lamps/wait_off.png', on: 'lamps/wait_on.png' } },
      { id: 'lampInsert', type: 'image', rect: [935, 895, 100, 92], z: 30, label: 'INSERT',
        states: { off: 'lamps/insert_off.png', on: 'lamps/insert_on.png' } },

      // ---- 上部ボーナス表示パネル（BIG/REG中に点灯） ----
      { id: 'bonusPanel', type: 'image', rect: [150, 420, 850, 112], z: 30, label: 'BONUSパネル',
        states: { off: 'lamps/bonus_panel_off.png', big: 'lamps/bonus_panel_big.png', reg: 'lamps/bonus_panel_reg.png' },
        anim: 'blink' },

      // ---- ③ LUCKY CHANCE 告知ランプ ----
      { id: 'luckyLamp', type: 'image', rect: [385, 940, 315, 212], z: 40, label: 'LUCKY CHANCE',
        states: { off: 'lamps/lucky_off.png', on: 'lamps/lucky_on.png', premium: 'lamps/lucky_premium.png' }, anim: 'glow' },

      // ---- ⑦ CREDIT / COUNT / PAYOUT ----
      { id: 'creditDisplay', type: 'display', rect: [125, 1022, 137, 78], z: 30, label: 'CREDIT', digits: 3 },
      { id: 'countDisplay',  type: 'display', rect: [795, 1022, 112, 78], z: 30, label: 'COUNT',  digits: 4 },
      { id: 'payoutDisplay', type: 'display', rect: [933, 1022, 108, 78], z: 30, label: 'PAYOUT', digits: 3 },
      // ボーナス合計獲得枚数（ボーナス中〜終了後の次ゲームまで、上部パネル中央に表示）
      { id: 'bonusGotDisplay', type: 'display', rect: [395, 434, 290, 88], z: 35, label: 'BONUS獲得', digits: 3, hidden: true },

      // ---- ④ STOP ボタン ×3 ----
      { id: 'stop0', type: 'image', rect: [303, 1328, 125, 125], z: 50, hit: 30, label: 'STOP', reel: 0,
        states: { off: 'buttons/stop_off.png', on: 'buttons/stop_on.png', pressed: 'buttons/stop_pressed.png' } },
      { id: 'stop1', type: 'image', rect: [476, 1328, 125, 125], z: 50, hit: 30, label: 'STOP', reel: 1,
        states: { off: 'buttons/stop_off.png', on: 'buttons/stop_on.png', pressed: 'buttons/stop_pressed.png' } },
      { id: 'stop2', type: 'image', rect: [650, 1328, 125, 125], z: 50, hit: 30, label: 'STOP', reel: 2,
        states: { off: 'buttons/stop_off.png', on: 'buttons/stop_on.png', pressed: 'buttons/stop_pressed.png' } },

      // ---- BET ボタン（1タップ1枚・最大3枚）。正式デザインのメダル受け左の銀色ボタン位置 ----
      { id: 'betButton', type: 'image', rect: [245, 1172, 130, 92], z: 50, hit: 22, label: 'BET',
        states: { off: 'buttons/bet_off.png', on: 'buttons/bet_on.png', pressed: 'buttons/bet_pressed.png' } },

      // ---- レバー（実物レバー。タップで現在のBET枚数のままレバーON） ----
      { id: 'leverKnob', type: 'image', rect: [40, 1285, 165, 170], z: 50, hit: 20, label: 'レバー',
        states: { idle: 'buttons/lever_knob.png', down: 'buttons/lever_knob_down.png' } },

      // ---- ⑤ LEVER ON ボタン ----
      { id: 'leverOn', type: 'image', rect: [373, 1460, 330, 330], z: 50, label: 'LEVER ON',
        states: { off: 'buttons/lever_on_off.png', on: 'buttons/lever_on_on.png', pressed: 'buttons/lever_on_pressed.png' } },

      // ---- ⑥ AUTO PLAY / MENU ----
      { id: 'autoPlay', type: 'image', rect: [180, 1600, 155, 100], z: 50, hit: 20, label: 'AUTO PLAY',
        states: { off: 'buttons/auto_off.png', on: 'buttons/auto_on.png', pressed: 'buttons/auto_pressed.png' } },
      { id: 'menu', type: 'image', rect: [750, 1600, 150, 100], z: 50, hit: 20, label: 'MENU',
        states: { off: 'buttons/menu_off.png', pressed: 'buttons/menu_pressed.png' } },

      // ---- ドル箱カウンター（タップでドル箱専用画面）。筐体下部スピーカー部の左端 ----
      { id: 'boxCounter', type: 'image', rect: [36, 1792, 300, 96], z: 50, hit: 16, label: 'BOX',
        states: { normal: 'boxes/box_counter.png' } },

      // ---- ⑧ BIG / REG 演出表示（リール窓の上に重ねる演出レイヤー） ----
      { id: 'bonusEffect', type: 'effect', rect: [145, 545, 790, 420], z: 60, label: 'BIG/REG演出', passThrough: true,
        states: { none: null, big: 'effects/big_logo.png', reg: 'effects/reg_logo.png', fanfare: 'effects/fanfare_flash.png' },
        anim: 'bonusIn' }
    ],

    // LED数字スプライト（予定・未実装）: 現在は CSS のフォントで表示。導入時に cabinet.setDisplay を対応させる。
    ledDigits: { file: 'display/led_digits.png', cellWidth: 48, cellHeight: 78, chars: '0123456789' }
  };
})(typeof window !== 'undefined' ? window : globalThis);
