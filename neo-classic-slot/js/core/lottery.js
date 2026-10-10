/*
 * 内部抽選（レバーON時に1回だけ実行）
 * 停止制御・演出とは独立。結果は「フラグ」オブジェクトとして返す。
 *   flag = { bonus: null|'BIG'|'REG', small: null|'GRAPE'|..., mode: 出目モード, newBonus: bool }
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  function Lottery(rng) {
    this.rng = rng || Math.random;
    this.forced = null; // デバッグ用強制フラグ { role, mode }
  }

  // テーブルから1回抽選（乱数 0〜65535）
  Lottery.prototype.draw = function (tableName) {
    var table = NCS.LOTTERY_TABLES[tableName];
    var r = Math.floor(this.rng() * NCS.LOTTERY_DENOM);
    for (var i = 0; i < table.length; i++) {
      if (r < table[i].weight) return table[i].role;
      r -= table[i].weight;
    }
    return null; // ハズレ
  };

  Lottery.prototype.pickMode = function (w) {
    var total = 0, k;
    for (k in w) total += w[k];
    var r = this.rng() * total;
    for (k in w) { if (r < w[k]) return k; r -= w[k]; }
    return 'NORMAL';
  };

  /*
   * carriedBonus: 持ち越し中のボーナス（無ければ null）
   */
  /*
   * carriedBonus: 持ち越し中のボーナス
   * jr: ジャグ連チャンス中の抽選結果（js/core/jugren.js）。チャンス中のボーナスは jr.bonus だけで決まり、
   *     通常抽選は小役のみ（CARRY テーブル）で行う
   */
  Lottery.prototype.lever = function (carriedBonus, jr) {
    var flag = { bonus: carriedBonus || null, small: null, mode: 'NORMAL', newBonus: false };
    var role, forcedMode = null, smallOnly = !!carriedBonus || !!jr;

    if (this.forced) {
      role = this.forced.role;
      forcedMode = this.forced.mode || null;
      this.forced = null;
      if (smallOnly && NCS.ROLES[role] && NCS.ROLES[role].bonus) role = null; // 持ち越し中・チャンス中は小役のみ
    } else {
      role = this.draw(smallOnly ? 'CARRY' : 'NORMAL');
    }
    if (jr && jr.bonus) { flag.bonus = jr.bonus; flag.newBonus = true; }

    if (role && NCS.ROLES[role].bonus) {
      flag.bonus = role;
      flag.newBonus = true;
    } else if (role) {
      flag.small = role;
    }
    // 出目モード: 強制モードはそのフラグで有効な場合のみ採用（例: REG専用モードをBIGに適用しない）
    var w = flag.bonus ? NCS.REACHME_MODE_WEIGHTS[flag.bonus] : (flag.small && NCS.SMALL_MODE_WEIGHTS && NCS.SMALL_MODE_WEIGHTS[flag.small]);
    if (w) flag.mode = (forcedMode && w[forcedMode] > 0) ? forcedMode : this.pickMode(w);
    return flag;
  };

  NCS.Lottery = Lottery;

  // 抽選確率の検証（n 回抽選して理論値と比較）
  NCS.verifyLottery = function (n, rng) {
    var lot = new Lottery(rng);
    var counts = {}, i, role;
    for (i = 0; i < n; i++) {
      role = lot.draw('NORMAL') || 'HAZURE';
      counts[role] = (counts[role] || 0) + 1;
    }
    var rows = [], used = 0, bonusW = 0;
    NCS.LOTTERY_TABLES.NORMAL.forEach(function (e) {
      used += e.weight;
      if (NCS.ROLES[e.role].bonus) bonusW += e.weight;
      rows.push({ role: e.role, expected: NCS.LOTTERY_DENOM / e.weight, observed: n / (counts[e.role] || NaN), count: counts[e.role] || 0 });
    });
    rows.push({ role: 'HAZURE', expected: NCS.LOTTERY_DENOM / (NCS.LOTTERY_DENOM - used), observed: n / (counts.HAZURE || NaN), count: counts.HAZURE || 0 });
    var bonus = (counts.BIG || 0) + (counts.REG || 0);
    rows.push({ role: 'BONUS合算', expected: NCS.LOTTERY_DENOM / bonusW, observed: n / bonus, count: bonus });
    return rows;
  };
})(typeof window !== 'undefined' ? window : globalThis);
