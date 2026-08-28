/* 期望窗口优化后，复验高段位难度分离：档3~档6 相邻对战
 * node ladder4.js  （每对 3 局，交替先后手）
 */
'use strict';
const X = require('./js/game.js');

const CFG = X.LEVELS.map((l, i) => Object.assign({}, l, { time: [0.15, 0.35, 0.70, 1.40, 2.60, 5.00][i] }));

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

function matchup(first, second) {
  // second 为较高档；3 局：second 执红 1 局 + 执黑 2 局
  const games = [
    [CFG[second], CFG[first]],
    [CFG[first], CFG[second]],
    [CFG[first], CFG[second]]
  ];
  let winsHi = 0, winsLo = 0, draws = 0;
  for (const [cr, cb] of games) {
    const st = playGame(cr, cb, 220);
    if (st.result === 'draw') { draws++; continue; }
    const hiIsRed = cr === CFG[second];
    const hiWon = st.winner === X.RED ? hiIsRed : !hiIsRed;
    if (hiWon) winsHi++; else winsLo++;
  }
  const dec = winsHi + winsLo;
  const pct = dec ? Math.round((winsHi / dec) * 100) : 0;
  const verdict = winsHi > winsLo ? '高档更强' : winsHi === winsLo ? '持平' : '** 高档更弱 **';
  console.log(`档${first + 1}(${X.LEVELS[first].name}) vs 档${second + 1}(${X.LEVELS[second].name}): 高档 ${winsHi}/${winsLo} 和 ${draws} → 胜率 ${pct}%  ${verdict}`);
  return winsHi >= winsLo;
}

console.log('（期望窗口优化后）高段位复验\n');
const r1 = matchup(2, 3);
const r2 = matchup(3, 4);
const r3 = matchup(4, 5);
console.log('\n结论：' + (r1 && r2 && r3 ? '困难/大师/宗师 逐档更强，未发现倒挂' : '仍有高档不占优的对局样本（小样本波动可能）'));
process.exit(0);