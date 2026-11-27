// 固定時間ステップの時計。実時間 → ロジックの手数（1手 = STEP 秒）。
// 倍速は「実時間1秒あたりの手数」を増やすだけなので、2倍速でも計算結果は通常速度と同じになる。
export function createClock(step, { maxStepsPerFrame = 12 } = {}) {
  let acc = 0;
  return {
    speed: 1,
    paused: false,
    // realDt 秒ぶん進める。戻り値：実行すべき手数
    advance(realDt) {
      if (this.paused) return 0;
      acc += Math.min(realDt, 0.25) * this.speed; // タブ復帰などの大きな飛びは切り捨て
      let n = Math.floor(acc / step + 1e-9);
      acc -= n * step;
      if (n > maxStepsPerFrame) { n = maxStepsPerFrame; acc = 0; } // 重いときは描画を優先して取りこぼす
      return n;
    },
    // 描画の補間用（0〜1）
    alpha() { return Math.min(1, acc / step); },
    reset() { acc = 0; },
  };
}
