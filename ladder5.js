/* qsearch 终局修复后的复验
 * node ladder5.js qab   → 大师档带/不带静态搜索 4 局
 * node ladder5.js pairs → 档4vs档5（3局） + 档5vs档6（3局）
 */
'use strict';
const X = require('./js/game.js');
const mode = process.argv[2] || 'qab';

const CFG = X.LEVELS.map((l, i) => Object.assign({}, l, { time: [0.15, 0.35, 0.70, 1.40, 3.50, 5.00][i] }));
const L5_NoQ = Object.assign({}, CFG[4], { qsearch: false, name: '大师(无静态搜索)' });

function playGame(cfgRed, cfgBlack, maxPlies) {
  const g = X.createGame();
  let ply = 0;
  while (!X.gameStatus(g).over && ply < maxPlies) {
    const mvs = X.legalMoves(g);
    if (!mvs.length) break;
    const mv = X.searchBest(g, g.side === X.RED ? cfgRed : cfgBlack);
    if (!mv) break;
    X.make(g, mv, true);
    g.side = g.side === X.RED ? X.BLACK : X.RED;
    ply++;
  }
  return X.gameStatus(g);
}

function count(firstGames) {
  let w1 = 0, w2 = 0, d = 0;
  for (const [cr, cb] of firstGames) {
    const st = playGame(cr, cb, 220);
    if (st.result === 'draw') { d++; continue; }
    const firstIsRed = cr === firstGames[0][0];
    const firstWon = st.winner === X.RED ? firstIsRed : !firstIsRed;
    if (firstWon) w1++; else w2++;
  }
  const dec = w1 + w2;
  console.log(`  前者胜率 ${dec ? Math.round((w1 / dec) * 100) : 0}%  (${w1}胜/${w2}负/和${d})`);
  return w1 > w2;
}

if (mode === 'qab') {
  console.log('== 大师档 带静态搜索 vs 不带（各 4 局，交替先后手） ==');
  const okR = count([
    [CFG[4], L5_NoQ], [CFG[4], L5_NoQ],
    [L5_NoQ, CFG[4]], [L5_NoQ, CFG[4]]
  ]);
  console.log(okR ? '✔ qsearch 修复后带静态搜索更优' : '✘ 带静态搜索仍不占优');
} else {
  console.log('== 档4(困难) vs 档5(大师)（3 局） ==');
  count([
    [CFG[4], CFG[3]], [CFG[3], CFG[4]], [CFG[3], CFG[4]]
  ]);
  console.log('== 档5(大师) vs 档6(宗师)（3 局） ==');
  count([
    [CFG[5], CFG[4]], [CFG[4], CFG[5]], [CFG[4], CFG[5]]
  ]);
}
console.log('（进程结束）');
process.exit(0);