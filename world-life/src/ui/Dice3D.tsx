import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store/gameStore';

// 各目を正面に向ける回転（front=1, top=2, right=3, left=4, bottom=5, back=6）
const FACE_ROT: Record<number, [number, number]> = {
  1: [0, 0],
  2: [-90, 0],
  3: [0, -90],
  4: [0, 90],
  5: [90, 0],
  6: [0, 180],
};

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Face({ n, cls }: { n: number; cls: string }) {
  return (
    <div className={`die-face ${cls}${n === 1 ? ' one' : ''}`}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={PIPS[n].includes(i) ? 'pip' : ''} />
      ))}
    </div>
  );
}

/** CSS 3D サイコロ。結果の面へ数回転してから止まる */
export function Dice3D() {
  const face = useGame((s) => s.diceFace);
  const rollId = useGame((s) => s.diceRollId);
  const rolling = useGame((s) => s.diceRolling);
  const fast = useGame((s) => s.fastForward);
  const spins = useRef({ x: -20, y: 25 });
  const [rot, setRot] = useState({ x: -20, y: 25, dur: 0 });
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    if (!rollId || !face) return;
    const [fx, fy] = FACE_ROT[face];
    // 現在角度から 2〜3 周多く回して目的の面へ
    const turnsX = 2 + Math.floor(Math.random() * 2);
    const turnsY = 2 + Math.floor(Math.random() * 2);
    const baseX = Math.ceil(spins.current.x / 360) * 360 + turnsX * 360;
    const baseY = Math.ceil(spins.current.y / 360) * 360 + turnsY * 360;
    const next = { x: baseX + fx, y: baseY + fy };
    spins.current = next;
    setLanded(false);
    setRot({ ...next, dur: fast ? 110 : 900 });
  }, [rollId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!rolling && rollId) setLanded(true);
  }, [rolling, rollId]);

  return (
    <div className={`die-stage${rolling ? ' rolling' : ''}`}>
      {landed && <div className="die-ring" key={`r${rollId}`} />}
      <div
        className="die"
        style={{
          transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
          transitionDuration: `${rot.dur}ms`,
        }}
      >
        <Face n={1} cls="f-front" />
        <Face n={6} cls="f-back" />
        <Face n={3} cls="f-right" />
        <Face n={4} cls="f-left" />
        <Face n={2} cls="f-top" />
        <Face n={5} cls="f-bottom" />
      </div>
      {landed && face && <div className="die-result" key={rollId}>{face}</div>}
    </div>
  );
}
