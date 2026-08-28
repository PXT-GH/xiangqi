/* 提示强度检验：
 * 1) 旧提示（4层@1s 确定性+静态搜索）vs 新提示（≤3层@0.6s 带随机）—— 证明新提示更弱
 * 2) 新提示 vs 宗师 AI —— 证明宗师现在明显强于提示
 * node hinttest.js
 */
'use strict';
const X = require('./js/game.js');

const OLD_HINT = { name: '旧提示', maxDepth: 4, time: 1.0, margin: 0, qsearch: true, random: false };
const NEW_HINT = { name: '新提示', maxDepth: 3, time: 0.6, margin: 30, qsearch: false, random: false };
const ZONG = Object.assign({}, X.LEVELS[5], { name: '宗师AI' });

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

function match(name, games) {
  let w1 = 0, w2 = 0, d = 0;
  for (const [cr, cb] of games) {
    const st = playGame(cr, cb, 200);
    if (st.result === 'draw') { d++; continue; }
    const firstIsRed = cr === games[0][0];
    const firstWon = st.winner === X.RED ? firstIsRed : !firstIsRed;
    if (firstWon) w1++; else w2++;
  }
  console.log(name + ': 前者 ' + w1 + '胜/' + w2 + '负/和' + d);
}

console.log('== 旧提示 vs 新提示（4 局） ==');
match('旧提示(红黑各2局) vs 新提示', [
  [OLD_HINT, NEW_HINT], [OLD_HINT, NEW_HINT],
  [NEW_HINT, OLD_HINT], [NEW_HINT, OLD_HINT]
]);
console.log('== 新提示 vs 宗师AI（2 局） ==');
match('新提示(执黑2局) vs 宗师AI', [
  [ZONG, NEW_HINT], [ZONG, NEW_HINT]
]);
console.log('（进程结束）');
process.exit(0);