/* ============================================================
 * 象棋核心规则与 AI 测试（node test.js）
 * ============================================================ */
'use strict';
const X = require('./js/game.js');

let passed = 0, failed = 0;
function ok(cond, name) {
  if (cond) { passed++; console.log('  ✓', name); }
  else { failed++; console.error('  ✗ FAIL:', name); }
}
function eq(a, b, name) { ok(a === b, name + '  (' + a + (a === b ? '' : ' ≠ ' + b) + ')'); }

function makePos(red, black, side) {
  // red/black: 数组 [code, r, c]，code 用正数
  const s = X.createGame();
  s.board.fill(0);
  s.rep.clear();
  s.kg[1] = -1; s.kg[-1] = -1;
  const place = (list, sign) => {
    for (const [code, r, c] of list) {
      s.board[r * 9 + c] = sign * code;
      if (code === X.K) s.kg[sign] = r * 9 + c;
    }
  };
  place(red, 1); place(black, -1);
  s.side = side || X.RED;
  s.rep.set(X.keyOf(s), 1);
  return s;
}
function moveSet(s, side) {
  return new Set(X.legalMoves(s, side).map(v => v.f + '>' + v.t));
}
function idx(r, c) { return r * 9 + c; }

/* ---------------- 1. 开局 ---------------- */
console.log('\n== 开局 ==');
{
  const s = X.createGame();
  const gen = X.genAll(s, X.RED);
  eq(gen.length, 44, '开局红方伪合法走法 = 44');
  eq(X.legalMoves(s, X.RED).length, 44, '开局红方合法走法 = 44（无将军过滤）');
  eq(X.legalMoves(s, X.BLACK).length, 44, '黑方对称 44');
  eq(X.evaluate(s), 0, '开局评估为 0');

  const byCode = {};
  for (const mv of gen) {
    const c = mv.piece < 0 ? -mv.piece : mv.piece;
    byCode[c] = (byCode[c] || 0) + 1;
  }
  eq(byCode[X.N], 4, '马 4 步');
  eq(byCode[X.C], 24, '炮 24 步');
  eq(byCode[X.P], 5, '兵 5 步');
  eq(byCode[X.B], 4, '象 4 步');
  eq(byCode[X.A], 2, '仕 2 步');
  eq(byCode[X.K], 1, '帅 1 步（帅五进一）');
  eq(byCode[X.R], 4, '车 4 步（车一进一/二、车九进一/二）');
}

/* ---------------- 2. 炮 ---------------- */
console.log('\n== 炮 ==');
{
  // 隔一子打：黑卒为炮架，吃 (2,4) 黑卒
  let s = makePos([[X.K, 9, 4], [X.C, 5, 4]], [[X.K, 0, 5], [X.P, 3, 4], [X.P, 2, 4]], X.RED);
  let ms = moveSet(s);
  ok(ms.has(idx(5, 4) + '>' + idx(2, 4)), '炮隔一子（黑卒为炮架）吃黑卒');
  ok(!ms.has(idx(5, 4) + '>' + idx(1, 4)), '炮不能隔着两枚棋子吃');
  ok(!ms.has(idx(5, 4) + '>' + idx(0, 4)), '炮不能隔两子吃底线');

  // 无炮架不能吃，但可走到目标格
  s = makePos([[X.K, 9, 4], [X.C, 6, 4]], [[X.K, 0, 5], [X.R, 4, 4]], X.RED);
  ms = moveSet(s);
  ok(!ms.has(idx(6, 4) + '>' + idx(4, 4)), '无炮架不能隔空吃');
  s = makePos([[X.K, 9, 4], [X.C, 5, 4]], [[X.K, 0, 5], [X.R, 3, 4]], X.RED);
  ms = moveSet(s);
  ok(ms.has(idx(5, 4) + '>' + idx(4, 4)), '炮可在炮架前任意落子');
  ok(!ms.has(idx(5, 4) + '>' + idx(2, 4)), '炮不能越过炮架（非吃子）');

  // 炮打隔一子：3,4 黑卒为架，吃 2,4 黑车
  s = makePos([[X.K, 9, 4], [X.C, 5, 4]], [[X.K, 0, 5], [X.P, 3, 4], [X.R, 2, 4]], X.RED);
  ms = moveSet(s);
  ok(ms.has(idx(5, 4) + '>' + idx(2, 4)), '炮打隔一子（3,4 黑卒为架，吃 2,4 黑车）');
}

/* ---------------- 3. 兵 ---------------- */
console.log('\n== 兵 ==');
{
  let s = makePos([[X.K, 9, 4], [X.P, 5, 4]], [[X.K, 0, 5]], X.RED);
  let ms = moveSet(s);
  ok(ms.has(idx(5, 4) + '>' + idx(4, 4)), '未过河兵前进一步');
  ok(!ms.has(idx(5, 4) + '>' + idx(5, 3)), '未过河兵不能横走');

  s = makePos([[X.K, 9, 4], [X.P, 4, 4]], [[X.K, 0, 5]], X.RED);
  ms = moveSet(s);
  ok(ms.has(idx(4, 4) + '>' + idx(3, 4)), '过河兵前进一步');
  ok(ms.has(idx(4, 4) + '>' + idx(4, 3)), '过河兵可横走');
  ok(!ms.has(idx(4, 4) + '>' + idx(5, 4)), '兵不能后退');

  s = makePos([[X.K, 9, 4], [X.P, 0, 4]], [[X.K, 0, 5]], X.RED);
  ms = moveSet(s);
  ok(ms.has(idx(0, 4) + '>' + idx(0, 3)), '底线兵可横走');

  s = makePos([[X.K, 9, 5]], [[X.K, 0, 4], [X.P, 4, 4]], X.BLACK);
  ms = moveSet(s, X.BLACK);
  ok(ms.has(idx(4, 4) + '>' + idx(5, 4)), '黑卒未过河前进');
  ok(!ms.has(idx(4, 4) + '>' + idx(4, 3)), '黑卒未过河不能横走');
  s = makePos([[X.K, 9, 5]], [[X.K, 0, 4], [X.P, 5, 4]], X.BLACK);
  ms = moveSet(s, X.BLACK);
  ok(ms.has(idx(5, 4) + '>' + idx(5, 3)), '黑卒过河可横走');
  ok(ms.has(idx(5, 4) + '>' + idx(6, 4)), '黑卒过河仍可前进');
  ok(!ms.has(idx(5, 4) + '>' + idx(4, 4)), '黑卒不能后退');
}

/* ---------------- 4. 象 / 马 ---------------- */
console.log('\n== 象 / 马 ==');
{
  let s = makePos([[X.K, 9, 4], [X.B, 7, 4]], [[X.K, 0, 5], [X.B, 5, 4]], X.RED);
  let ms = moveSet(s);
  ok(ms.has(idx(7, 4) + '>' + idx(5, 2)), '象可走到 (5,2)');
  ok(!ms.has(idx(7, 4) + '>' + idx(3, 2)), '象不能过河');

  s = makePos([[X.K, 9, 4], [X.B, 9, 2]], [[X.K, 0, 5], [X.P, 8, 1]], X.RED);
  ms = moveSet(s);
  ok(!ms.has(idx(9, 2) + '>' + idx(7, 0)), '象眼被塞不能走');
  ok(ms.has(idx(9, 2) + '>' + idx(7, 4)), '另一侧象眼畅通可走');

  s = makePos([[X.K, 9, 4], [X.N, 5, 4]], [[X.K, 0, 5], [X.P, 6, 4]], X.RED);
  ms = moveSet(s);
  ok(!ms.has(idx(5, 4) + '>' + idx(7, 3)), '马腿被塞不能走 (7,3)');
  ok(!ms.has(idx(5, 4) + '>' + idx(7, 5)), '马腿被塞不能走 (7,5)');
  ok(ms.has(idx(5, 4) + '>' + idx(4, 6)), '另一方向可走 (4,6)');

  // 马的完整走法（无遮挡）：8 个目标
  s = makePos([[X.K, 9, 4], [X.N, 5, 4]], [[X.K, 0, 5]], X.RED);
  ms = moveSet(s);
  eq([...ms].filter(m => m.startsWith(idx(5, 4) + '>')).length, 8, '中心马 8 个落点');
}

/* ---------------- 5. 仕 / 帅 ---------------- */
console.log('\n== 仕 / 帅 ==');
{
  let s = makePos([[X.K, 9, 4], [X.A, 9, 3]], [[X.K, 0, 5]], X.RED);
  let ms = moveSet(s);
  ok(ms.has(idx(9, 3) + '>' + idx(8, 4)), '仕斜进一步');
  ok(!ms.has(idx(9, 3) + '>' + idx(8, 2)), '仕不能出九宫');
  ok(!ms.has(idx(9, 3) + '>' + idx(10, 4)), '仕不能出界');

  s = makePos([[X.K, 9, 4]], [[X.K, 0, 4]], X.RED);
  ms = moveSet(s);
  ok(ms.has(idx(9, 4) + '>' + idx(9, 3)) && ms.has(idx(9, 4) + '>' + idx(9, 5)), '帅可平移到两侧');
  ok(!ms.has(idx(9, 4) + '>' + idx(8, 4)), '帅进一因与黑将同列照面 → 非法（飞将）');
  ok(!ms.has(idx(9, 4) + '>' + idx(8, 3)), '帅不能斜走');
  ok(!ms.has(idx(9, 4) + '>' + idx(8, 5)), '帅不能斜走(2)');

  s = makePos([[X.K, 8, 4]], [[X.K, 0, 5]], X.RED);
  ms = moveSet(s);
  ok(ms.has(idx(8, 4) + '>' + idx(9, 4)) && ms.has(idx(8, 4) + '>' + idx(7, 4)), '帅可在宫内上下');
  ok(!ms.has(idx(8, 4) + '>' + idx(8, 2)), '帅不能出宫横移');
}

/* ---------------- 6. 飞将 / 自将 ---------------- */
console.log('\n== 飞将 / 自将 ==');
{
  // 两将同列且中间无子：任何让开挡子的走法非法
  let s = makePos([[X.K, 9, 4], [X.R, 5, 4]], [[X.K, 0, 4]], X.RED);
  let ms = moveSet(s);
  ok(!ms.has(idx(5, 4) + '>' + idx(5, 3)), '车让开中列导致飞将 → 非法');
  ok(ms.has(idx(5, 4) + '>' + idx(3, 4)), '车留在中列可行');

  // 移动后自将：红车离开 (6,4) 后，黑炮恰好隔黑车一子将军
  s = makePos([[X.K, 9, 4], [X.R, 6, 4]], [[X.K, 0, 5], [X.C, 3, 4], [X.R, 5, 4]], X.RED);
  ms = moveSet(s);
  ok(!ms.has(idx(6, 4) + '>' + idx(6, 0)), '红车离开让黑炮恰好隔一子将军 → 非法');
  ok(ms.has(idx(6, 4) + '>' + idx(7, 4)), '往将一侧靠仍两子相隔 → 合法');
}

/* ---------------- 7. 将死 / 困毙 ---------------- */
console.log('\n== 将死 / 困毙 ==');
{
  // 车将死：黑将 (0,4) 被 (1,4) 红车将军；(1,4) 吃车因飞将非法；
  // (0,3)/(0,5) 被红车控制；(0,4) 两侧无宫外出口
  let s = makePos(
    [[X.K, 9, 4], [X.R, 1, 4], [X.R, 1, 3], [X.R, 1, 5]],
    [[X.K, 0, 4]], X.BLACK
  );
  ok(X.isInCheck(s, X.BLACK), '黑将被将军');
  eq(X.legalMoves(s, X.BLACK).length, 0, '黑方无合法走法（吃车因飞将非法）');
  let st = X.gameStatus(s);
  eq(st.result, 'checkmate', '判将死（checkmate）');
  eq(st.winner, X.RED, '红方获胜');

  // 困毙：黑将无处可走且未受将军
  s = makePos(
    [[X.K, 9, 3], [X.R, 1, 3], [X.R, 1, 5]],
    [[X.K, 0, 4]], X.BLACK
  );
  ok(!X.isInCheck(s, X.BLACK), '困毙局面未直接将军');
  eq(X.legalMoves(s, X.BLACK).length, 0, '黑方无合法走法');
  st = X.gameStatus(s);
  eq(st.result, 'stalemate', '判困毙（stalemate）');
  eq(st.winner, X.RED, '红方获胜');
}

/* ---------------- 8. 走子/撤销往返 + 重复判和 ---------------- */
console.log('\n== 历史与判和 ==');
{
  // 双车对摆，来回两步循环，第 3 次重现初始局面判和
  let s = makePos(
    [[X.K, 9, 4], [X.R, 5, 4]],
    [[X.K, 0, 4], [X.R, 4, 4]], X.BLACK
  );
  const moves = [
    [idx(4, 4), idx(4, 3)],   // 黑车左
    [idx(5, 4), idx(5, 3)],   // 红车左
    [idx(4, 3), idx(4, 4)],   // 黑车回
    [idx(5, 3), idx(5, 4)],   // 红车回（第 2 次出现）
    [idx(4, 4), idx(4, 3)],
    [idx(5, 4), idx(5, 3)],
    [idx(4, 3), idx(4, 4)],
    [idx(5, 3), idx(5, 4)]    // 第 3 次出现 → 判和
  ];
  let drawAt = -1;
  for (let i = 0; i < moves.length; i++) {
    const [f, t] = moves[i];
    X.make(s, { f, t, piece: s.board[f], captured: s.board[t] }, true);
    s.side = s.side === X.RED ? X.BLACK : X.RED;
    const st = X.gameStatus(s);
    if (st.over && st.result === 'draw') { drawAt = i + 1; break; }
  }
  eq(drawAt, 8, '第 3 次循环重现时判和（第 8 手）');
  ok(drawAt > 0, '确实触发判和');

  // 随机 30 手后再全部撤销，必须回到起点
  s = makePos([[X.K, 9, 4], [X.R, 5, 4], [X.P, 6, 3]], [[X.K, 0, 5], [X.C, 3, 3]], X.RED);
  const b0 = s.board.slice();
  const hist = [];
  for (let i = 0; i < 30; i++) {
    const mvs = X.legalMoves(s);
    if (!mvs.length) break;
    const mv = mvs[(Math.random() * mvs.length) | 0];
    X.make(s, mv, true);
    hist.push(mv);
    s.side = s.side === X.RED ? X.BLACK : X.RED;
  }
  ok(hist.length === 30, '30 手随机走子完成');
  for (let i = hist.length - 1; i >= 0; i--) {
    s.side = s.side === X.RED ? X.BLACK : X.RED;
    X.unmake(s, hist[i], true);
  }
  ok(s.board.join() === b0.join(), '30 手后撤销回到起始盘面');
  ok(s.history.length === 0, '撤销后历史为空');
}

/* ---------------- 9. 开局库 ---------------- */
console.log('\n== 开局库 ==');
{
  const replyKeys = [
    '7,1>7,4', '7,7>7,4', '9,1>7,2', '9,7>7,6',
    '6,0>5,0', '6,2>5,2', '6,4>5,4', '9,2>7,4',
    '9,6>7,4', '9,3>8,4', '9,5>8,4', '7,1>7,3', '7,7>7,5'
  ];
  let allLegal = true;
  for (const key of replyKeys) {
    const g = X.createGame();
    const [fr, fc, tr, tc] = key.split('>').join(',').split(',').map(Number);
    // 红方第一步本身必须合法
    const redMoves = moveSet(g, X.RED);
    if (!redMoves.has((fr * 9 + fc) + '>' + (tr * 9 + tc))) {
      allLegal = false;
      console.error('    开局库红方着法非法:', key);
      continue;
    }
    X.make(g, { f: fr * 9 + fc, t: tr * 9 + tc, piece: g.board[fr * 9 + fc], captured: 0 }, true);
    g.side = X.BLACK;   // 红方已走，轮到黑方
    const bk = X.bookMove(g, X.BLACK);
    const ms = moveSet(g, X.BLACK);
    if (!bk || !ms.has(bk.f + '>' + bk.t)) {
      allLegal = false;
      console.error('    非法开局库应着:', key, bk && (bk.f + '>' + bk.t));
    }
  }
  ok(allLegal, '所有开局库着法（红方第一步与黑方应着）均合法');

  const g0 = X.createGame();
  const bk0 = X.bookMove(g0, X.RED);
  ok(bk0 && moveSet(g0).has(bk0.f + '>' + bk0.t), 'AI 执红首着合法');
}

/* ---------------- 10. AI 冒烟测试 ---------------- */
console.log('\n== AI ==');
{
  // 难度配置单调性：深度/时间严格递增、随机性递减，防止难度配置回退
  const LEVELS = X.LEVELS;
  let mono = true;
  for (let i = 1; i < LEVELS.length; i++) {
    const a = LEVELS[i - 1], b = LEVELS[i];
    if (!(b.maxDepth > a.maxDepth && b.time > a.time)) {
      mono = false;
      console.error('    难度倒挂(深度/时间): 档' + i, JSON.stringify(a), '→', JSON.stringify(b));
    }
  }
  // margin（随机性）全程严格递减（全体难度上移后入门也使用 margin）
  for (let i = 1; i < LEVELS.length; i++) {
    if (LEVELS[i].margin > LEVELS[i - 1].margin) {
      mono = false;
      console.error('    难度倒挂(随机性 margin): 档' + (i + 1), LEVELS[i].margin, '>', LEVELS[i - 1].margin);
    }
  }
  ok(mono, '六档难度 maxDepth/time 严格递增、随机 margin 逐档递减');
  ok(!LEVELS[0].random && LEVELS[0].maxDepth >= 2, '入门档为 2 层搜索（全体难度已上移两档）');
  ok(LEVELS[0].margin >= 40, '入门档保留较明显随机性（margin≥40）');
  ok(LEVELS[3].qsearch && LEVELS[4].qsearch && LEVELS[5].qsearch, '静态搜索用于困难/大师/宗师档');
  ok(LEVELS[5].maxDepth >= 7, '宗师档 7 层搜索');

  const cfgSmall = [
    { name: '入门', maxDepth: 1, time: 0.05, margin: 0, qsearch: false, random: true },
    { name: '简单', maxDepth: 2, time: 0.05, margin: 150, qsearch: false, random: false },
    { name: '普通', maxDepth: 3, time: 0.08, margin: 60, qsearch: false, random: false },
    { name: '困难', maxDepth: 4, time: 0.10, margin: 20, qsearch: false, random: false },
    { name: '大师', maxDepth: 4, time: 0.12, margin: 10, qsearch: true, random: false },
    { name: '宗师', maxDepth: 5, time: 0.15, margin: 0, qsearch: true, random: false }
  ];

  // 20 个随机中局 × 六个档位 → 每步都合法
  let bad = 0;
  for (let trial = 0; trial < 20; trial++) {
    const g = X.createGame();
    let ply = 0;
    while (ply < 12) {
      const mvs = X.legalMoves(g);
      if (!mvs.length) break;
      X.make(g, mvs[(Math.random() * mvs.length) | 0], true);
      g.side = g.side === X.RED ? X.BLACK : X.RED;
      ply++;
    }
    for (let lv = 0; lv < 6; lv++) {
      const mv = X.searchBest(g, cfgSmall[lv]);
      if (mv) {
        const ms = moveSet(g);
        if (!ms.has(mv.f + '>' + mv.t)) { bad++; console.error('    ✗ 非法AI着法 层', lv, mv.f + '>' + mv.t); }
      }
    }
  }
  eq(bad, 0, '六个档位在随机局面上均返回合法走法');

  // 性能：宗师档全速搜索一次中局
  const g = X.createGame();
  let ply = 0;
  while (ply < 24) {
    const mvs = X.legalMoves(g);
    if (!mvs.length) break;
    X.make(g, mvs[(Math.random() * mvs.length) | 0], true);
    g.side = g.side === X.RED ? X.BLACK : X.RED;
    ply++;
  }
  const t0 = Date.now();
  const mv = X.searchBest(g, X.LEVELS[5]);
  const dt = Date.now() - t0;
  ok(mv && moveSet(g).has(mv.f + '>' + mv.t), '宗师档全速返回合法走法');
  ok(dt < 9500, '宗师档耗时 < 9.5s（实测 ' + (dt / 1000).toFixed(1) + 's）');
  console.log('    宗师档实测耗时 ' + (dt / 1000).toFixed(2) + 's');

  // AI 全对局：低档对中档（缩减版），必须正常终局且全程合法
  const G = X.createGame();
  let legalAll = true, limit = 0;
  while (!X.gameStatus(G).over && limit < 400) {
    const mvs = X.legalMoves(G);
    if (!mvs.length) break;
    const side = G.side;
    const cfg = side === X.RED ? cfgSmall[1] : cfgSmall[4];
    const mv = X.searchBest(G, cfg);
    if (!mv) break;
    if (!moveSet(G).has(mv.f + '>' + mv.t)) { legalAll = false; break; }
    X.make(G, mv, true);
    G.side = side === X.RED ? X.BLACK : X.RED;
    limit++;
  }
  const st = X.gameStatus(G);
  ok(legalAll, 'AI 对局全程合法');
  console.log('    AI 对局 ' + limit + ' 手后状态: ' + (st.over ? (st.result + '，胜方 ' + (st.winner === X.RED ? '红' : '黑')) : '未终局（限制手数）'));
  ok(st.over || limit >= 400, 'AI 对局未崩溃（限制 400 手）');
}

console.log('\n========================================');
console.log('通过 ' + passed + ' 项，失败 ' + failed + ' 项');
process.exit(failed ? 1 : 0);