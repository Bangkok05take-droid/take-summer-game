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

  Lottery.prototype.pickMode = function (bonus) {
    var w = NCS.REACHME_MODE_WEIGHTS[bonus], total = 0, k;
    for (k in w) total += w[k];
    var r = this.rng() * total;
    for (k in w) { if (r < w[k]) return k; r -= w[k]; }
    return 'NORMAL';
  };

  /*
   * carriedBonus: 持ち越し中のボーナス（無ければ null）
   */
  Lottery.prototype.lever = function (carriedBonus) {
    var flag = { bonus: carriedBonus || null, small: null, mode: 'NORMAL', newBonus: false };
    var role, forcedMode = null;

    if (this.forced) {
      role = this.forced.role;
      forcedMode = this.forced.mode || null;
      this.forced = null;
      if (carriedBonus && NCS.ROLES[role] && NCS.ROLES[role].bonus) role = null; // 持ち越し中は重複成立させない
    } else {
      role = this.draw(carriedBonus ? 'CARRY' : 'NORMAL');
    }

    if (role && NCS.ROLES[role].bonus) {
      flag.bonus = role;
      flag.newBonus = true;
    } else if (role) {
      flag.small = role;
    }
    if (flag.bonus) flag.mode = forcedMode || this.pickMode(flag.bonus);
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
