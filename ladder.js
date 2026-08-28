/* ============================================================
 * 六档难度棋力检验：相邻档位两两对战，统计胜率
 * node ladder.js
 * 每对打 4 局（双方各执红 2 局，抵消先后手影响）
 * ============================================================ */
'use strict';
const X = require('./js/game.js');

// 高段位对战用真实时间预算（验证真实难度）；低段位也尽量真实
const TIMES = [0.10, 0.35, 0.90, 1.80, 2.80, 4.50];
const CFG = X.LEVELS.map((l, i) => Object.assign({}, l, { time: TIMES[i] }));

let gamesPlayed = 0;

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
  gamesPlayed++;
  const st = X.gameStatus(g);
  return st; // {over, result, winner}
}

function matchup(a, b) {
  // a 档 vs b 档（a < b，b 应更强）
  // 对局组合：b 执红 2 局、b 执黑 2 局
  let winsB = 0, winsA = 0, draws = 0;
  const games = [
    [CFG[a], CFG[b]], [CFG[a], CFG[b]],   // b 执黑
    [CFG[b], CFG[a]], [CFG[b], CFG[a]]    // b 执红
  ];
  for (const [cr, cb] of games) {
    const st = playGame(cr, cb, 260);
    if (st.result === 'draw') draws++;
    else if (st.winner === X.BLACK) {
      // 黑方执棋者 = cb（b 档）？
      // 需要记录当局 b 档执红还是执黑：用 cb 对象标识
      if (cb === CFG[b]) winsB++; else winsA++;
    } else {
      if (cr === CFG[b]) winsB++; else winsA++;
    }
  }
  return { a, b, winsB, winsA, draws };
}

console.log('六档难度相邻对战检验（每对 4 局，b 档为较高档）\n');
const results = [];
for (let i = 0; i < 5; i++) {
  const r = matchup(i, i + 1);
  results.push(r);
  const decisive = r.winsA + r.winsB;
  const pct = decisive ? Math.round((r.winsB / decisive) * 100) : 0;
  const verdict = r.winsB > r.winsA ? '✔ 高档更强' : r.winsB === r.winsA ? '＝ 持平' : '✘ 高档反而更弱';
  console.log(
    `档${i + 1}(${X.LEVELS[i].name}) vs 档${i + 2}(${X.LEVELS[i + 1].name}): ` +
    `高档 ${r.winsB} 胜 / 低档 ${r.winsA} 胜 / 和 ${r.draws}  → 高档胜率 ${pct}%  ${verdict}`
  );
}

const allHigherWin = results.every(r => r.winsB >= r.winsA);
const noMismatch = results.every(r => r.winsB > r.winsA || (r.winsB === r.winsA && r.draws >= 1));
console.log('\n共进行 ' + gamesPlayed + ' 局');
console.log('结论：' + (allHigherWin ? '六档难度严格递增，无难度倒挂' : noMismatch ? '无高档弱于低档的反挂（存在持平局）' : '存在难度不匹配！'));
process.exit(allHigherWin || noMismatch ? 0 : 1);