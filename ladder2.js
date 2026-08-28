/* 六档难度精简对战检验（每对 2~3 局，结果即时输出）
 * node ladder2.js
 */
'use strict';
const X = require('./js/game.js');

const TIMES = [0.15, 0.35, 0.70, 1.40, 2.20, 3.20];
const CFG = X.LEVELS.map((l, i) => Object.assign({}, l, { time: TIMES[i] }));

function playGame(cfgRed, cfgBlack, maxPlies) {
  const g = X.createGame();
  let ply = 0;
  while (!X.gameStatus(g).over && ply < maxPlies) {
    const mvs = X.legalMoves(g);
    if (!mvs.length) break;
    const cfg = g.side === X.RED ? cfgRed : cfgBlack;
    const mv = X.searchBest(g, cfg);
    if (!mv) break;
    X.make(g, mv, true);
    g.side = g.side === X.RED ? X.BLACK : X.RED;
    ply++;
  }
  return X.gameStatus(g);
}

// 每对 3 局：高一档执红 1 局 + 执黑 2 局（抵消先后手）
function matchup(a, b) {
  const games = [[CFG[b], CFG[a]], [CFG[a], CFG[b]], [CFG[a], CFG[b]]]; // [红,黑]
  let winsB = 0, winsA = 0, draws = 0;
  for (const [cr, cb] of games) {
    const st = playGame(cr, cb, 200);
    const winnerIsB = st.winner === X.RED ? cr === CFG[b] : cb === CFG[b];
    if (st.result === 'draw') draws++;
    else if (winnerIsB) winsB++;
    else winsA++;
  }
  const decisive = winsA + winsB;
  const pct = decisive ? Math.round((winsB / decisive) * 100) : 0;
  const verdict = winsB > winsA ? '高档更强' : winsB === winsA ? '持平' : '** 高档更弱 **';
  console.log(`档${a + 1}(${X.LEVELS[a].name}) vs 档${b + 1}(${X.LEVELS[b].name}): 高档 ${winsB}/${winsA}(胜/负) 和 ${draws} → 高档胜率 ${pct}%  ${verdict}`);
  return winsB >= winsA;
}

console.log('六档难度相邻对战（每对 3 局，含先后手交换）\n');
const r1 = matchup(0, 1);
const r2 = matchup(1, 2);
const r3 = matchup(2, 3);
const r4 = matchup(3, 4);
const r5 = matchup(4, 5);
console.log('\n结论：' + (r1 && r2 && r3 && r4 && r5 ? '难度逐档递增，未发现倒挂' : '存在高档弱于低档的对局样本（需结合配置单调性判断）'));
process.exit(0);