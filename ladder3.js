/* 定向实验：
 * 1) 档4 vs 档5 加赛 4 局（交换先后手各 2 局）
 * 2) 大师档 qsearch 开关对局 4 局：验证静态搜索是否有益
 * node ladder3.js
 */
'use strict';
const X = require('./js/game.js');

const CFG = X.LEVELS.map((l, i) => Object.assign({}, l, { time: [0.15, 0.35, 0.70, 1.40, 2.20, 3.20][i] }));
const L5_NoQ = Object.assign({}, CFG[4], { qsearch: false, name: '大师(无静态搜索)' });

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

function match(name, games, maxPlies) {
  let wins1 = 0, wins2 = 0, draws = 0;
  for (const [cr, cb] of games) {
    const st = playGame(cr, cb, maxPlies);
    const w1 = st.winner === X.RED ? cr === games[0][0] || (cr.flag1) : false;
    // 通过引用判断胜者属于哪一方配置
    const winnerIsFirst = (st.winner === X.RED ? cr === games[0][0] : cb === games[0][1]);
    if (st.result === 'draw') draws++;
    else if (winnerIsFirst) wins1++;
    else wins2++;
  }
  const dec = wins1 + wins2;
  const pct = dec ? Math.round((wins1 / dec) * 100) : 0;
  console.log(`${name}: 前者 ${wins1}/${wins2}(胜/负) 和 ${draws} → 前者胜率 ${pct}%`);
  return { wins1, wins2, draws };
}

console.log('== 档4 vs 档5 加赛（4 局，交替先后手） ==');
match('档4(困难) vs 档5(大师)', [
  [CFG[4], CFG[3]], [CFG[4], CFG[3]],     // 大师执黑
  [CFG[3], CFG[4]], [CFG[3], CFG[4]]      // 大师执红
], 200);

console.log('\n== 大师档 qsearch 有无对比（4 局，交替先后手） ==');
match('大师(带静态搜索) vs 大师(无静态搜索)', [
  [CFG[4], L5_NoQ], [CFG[4], L5_NoQ],     // 无静态搜索执黑
  [L5_NoQ, CFG[4]], [L5_NoQ, CFG[4]]      // 无静态搜索执红
], 200);

console.log('\n（实验结束）');
process.exit(0);