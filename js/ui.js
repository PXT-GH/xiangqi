/* ============================================================
 * 中国象棋 · 界面层（Canvas 渲染 + 触摸交互）
 * 依赖 js/game.js（Xiangqi）
 * ============================================================ */
(function () {
  'use strict';
  var X = window.Xiangqi;
  var RED = X.RED, BLACK = X.BLACK;
  var RED_NAME = ['帅', '仕', '相', '马', '车', '炮', '兵'];
  var BLACK_NAME = ['将', '士', '象', '马', '车', '炮', '卒'];

  /* ---------------- 全局状态 ---------------- */
  var ui = {
    game: null,
    humanSide: localStorage.getItem('xj_side') === 'B' ? BLACK : RED,
    levelIdx: Math.min(5, Math.max(0, parseInt(localStorage.getItem('xj_level') || '2', 10) || 2)),
    soundOn: localStorage.getItem('xj_sound') !== '0',
    thinkToken: 0,          // AI 回合令牌，悔棋/重开会使其失效
    thinking: false,
    selected: -1,           // 选中的棋子 idx
    legalFrom: [],          // 选中棋子的合法目标
    lastMove: null,         // {f, t}
    drag: null,             // {from, x, y}
    overShown: false,
    hint: null,             // {f, t, timer}
    flipped: false
  };

  /* ---------------- DOM ---------------- */
  var canvas = document.getElementById('board');
  var ctx = canvas.getContext('2d');
  var statusText = document.getElementById('statusText');
  var thinkDot = document.getElementById('thinkDot');
  var overlay = document.getElementById('overlay');
  var resTitle = document.getElementById('resTitle');
  var resDesc = document.getElementById('resDesc');
  var stage = document.getElementById('stage');

  /* ---------------- 布局计算 ---------------- */
  var MARGIN = 0.78;      // 边距（用于写路数标记）
  var geo = { cell: 20, ox: 0, oy: 0, w: 0, h: 0 };

  function layout() {
    var availW = stage.clientWidth - 6;
    var availH = stage.clientHeight - 6;
    var cell = Math.max(14, Math.min(availW / (9 + 2 * MARGIN), availH / (10 + 2 * MARGIN)));
    var cw = Math.round(cell * (9 + 2 * MARGIN));
    var ch = Math.round(cell * (10 + 2 * MARGIN));
    var dpr = window.devicePixelRatio || 1;
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
    }
    geo.cell = cell;
    geo.ox = cell * MARGIN;
    geo.oy = cell * MARGIN;
    geo.w = cw; geo.h = ch;
  }

  /* ---------------- 坐标映射（支持执黑翻转） ---------------- */
  function l2s(r, c) {      // 逻辑坐标 → 屏幕坐标
    if (ui.flipped) { r = 9 - r; c = 8 - c; }
    return { x: geo.ox + c * geo.cell, y: geo.oy + r * geo.cell };
  }
  function s2l(x, y) {
    var c = Math.round((x - geo.ox) / geo.cell);
    var r = Math.round((y - geo.oy) / geo.cell);
    if (c < 0 || c > 8 || r < 0 || r > 9) return null;
    if (ui.flipped) { r = 9 - r; c = 8 - c; }
    return r * 9 + c;
  }
  function inStage(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }
  function stageXY(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  /* ---------------- 画棋盘（浅色木质风格） ---------------- */
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function drawBoard() {
    var cell = geo.cell, ox = geo.ox, oy = geo.oy;
    var W = cell * 9, H = cell * 10;

    // 木质底色（浅暖木色，参考实物棋盘）
    var g = ctx.createLinearGradient(0, 0, 0, geo.h);
    g.addColorStop(0, '#f5e9cc');
    g.addColorStop(0.5, '#eddcb3');
    g.addColorStop(1, '#e4d0a6');
    ctx.fillStyle = g;
    roundRect(ox - cell * 0.55, oy - cell * 0.55, W + cell * 1.1, H + cell * 1.1, cell * 0.28);
    ctx.fill();

    // 木纹（细竖纹理）
    ctx.save();
    roundRect(ox - cell * 0.55, oy - cell * 0.55, W + cell * 1.1, H + cell * 1.1, cell * 0.28);
    ctx.clip();
    var grains = [0.06, 0.17, 0.3, 0.44, 0.58, 0.71, 0.84, 0.95];
    for (var gi = 0; gi < grains.length; gi++) {
      var gx = (ox - cell * 0.55) + grains[gi] * (W + cell * 1.1);
      ctx.fillStyle = gi % 2 ? 'rgba(150,108,58,0.08)' : 'rgba(190,150,95,0.12)';
      ctx.fillRect(gx, oy - cell * 0.55, cell * (0.04 + 0.02 * (gi % 3)), H + cell * 1.1);
    }
    ctx.restore();

    // 边缘（细深色描边，模拟木板边缘）
    ctx.strokeStyle = 'rgba(110,80,45,0.5)';
    ctx.lineWidth = Math.max(1.5, cell * 0.05);
    roundRect(ox - cell * 0.55, oy - cell * 0.55, W + cell * 1.1, H + cell * 1.1, cell * 0.28);
    ctx.stroke();

    // 网格线（黑色细线）
    ctx.strokeStyle = 'rgba(38,33,26,0.92)';
    ctx.lineWidth = Math.max(1, cell * 0.035);
    for (var c = 0; c < 9; c++) {
      ctx.beginPath();
      ctx.moveTo(ox + c * cell, oy);
      ctx.lineTo(ox + c * cell, oy + H);
      ctx.stroke();
    }
    for (var r = 0; r < 10; r++) {
      if (r === 4 || r === 5) {   // 河界横线
        ctx.beginPath();
        ctx.moveTo(ox, oy + r * cell);
        ctx.lineTo(ox + W, oy + r * cell);
        ctx.stroke();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(ox, oy + r * cell);
      ctx.lineTo(ox + W, oy + r * cell);
      ctx.stroke();
    }

    // 九宫斜线
    var diag = [[0, 3, 2, 5], [0, 5, 2, 3], [7, 3, 9, 5], [7, 5, 9, 3]];
    for (var i = 0; i < 4; i++) {
      var a = l2s(diag[i][0], diag[i][1]), b = l2s(diag[i][2], diag[i][3]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // 楚河 汉界（黑色书法感）
    ctx.fillStyle = 'rgba(38,33,26,0.95)';
    ctx.font = '700 ' + Math.round(cell * 0.5) + 'px "STKaiti","KaiTi","SimSun","Noto Serif SC",serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var midY = oy + 4.5 * cell;
    ctx.fillText('楚河', ox + 2.2 * cell, midY + cell * 0.02);
    ctx.fillText('汉界', ox + 6.8 * cell, midY + cell * 0.02);
  }

  /* ---------------- 画棋子 ---------------- */
  function drawPiece(sq, piece, alpha, scale, glow) {
    var r = (sq / 9) | 0, c = sq % 9;
    var p = l2s(r, c);
    var rad = geo.cell * 0.42 * (scale || 1);
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;

    if (glow) {   // 选中高亮（琥珀色）
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad + geo.cell * 0.09, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(198,136,32,0.95)';
      ctx.lineWidth = Math.max(2.5, geo.cell * 0.09);
      ctx.stroke();
    }

    // 阴影
    ctx.beginPath();
    ctx.arc(p.x + geo.cell * 0.04, p.y + geo.cell * 0.06, rad, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(60,35,10,0.28)';
    ctx.fill();

    // 棋子圆面（木色，与棋盘同色系而略浅）
    var g = ctx.createRadialGradient(p.x - rad * 0.35, p.y - rad * 0.4, rad * 0.15, p.x, p.y, rad);
    g.addColorStop(0, '#fbf3e0');
    g.addColorStop(0.75, '#f2e3bd');
    g.addColorStop(1, '#e9d7ae');
    ctx.beginPath();
    ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    // 描边（细深色，红黑同款）
    ctx.lineWidth = Math.max(1.2, geo.cell * 0.04);
    ctx.strokeStyle = 'rgba(92,66,34,0.8)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.x, p.y, rad * 0.8, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(120,90,50,0.3)';
    ctx.lineWidth = Math.max(1, geo.cell * 0.028);
    ctx.stroke();

    // 文字（书法体；红方红字、黑方黑字）
    var code = piece > 0 ? piece : -piece;
    var ch = piece > 0 ? RED_NAME[code - 1] : BLACK_NAME[code - 1];
    ctx.font = '700 ' + Math.round(geo.cell * 0.54) + 'px "STKaiti","KaiTi","SimSun","Noto Serif SC",serif';
    ctx.fillStyle = piece > 0 ? '#a92b1d' : '#27221b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, p.x, p.y + geo.cell * 0.02);
    ctx.restore();
  }

  /* ---------------- 主绘制 ---------------- */
  function draw() {
    var dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBoard();

    var b = ui.game.board;

    // 上一步高亮
    if (ui.lastMove) {
      var a = l2s((ui.lastMove.f / 9) | 0, ui.lastMove.f % 9);
      var t2 = l2s((ui.lastMove.t / 9) | 0, ui.lastMove.t % 9);
      ctx.fillStyle = 'rgba(226,156,54,0.4)';
      ctx.fillRect(a.x - geo.cell / 2, a.y - geo.cell / 2, geo.cell, geo.cell);
      ctx.fillRect(t2.x - geo.cell / 2, t2.y - geo.cell / 2, geo.cell, geo.cell);
    }

    // 提示闪烁
    if (ui.hint) {
      var hf = l2s((ui.hint.f / 9) | 0, ui.hint.f % 9);
      var ht = l2s((ui.hint.t / 9) | 0, ui.hint.t % 9);
      ctx.strokeStyle = 'rgba(46,125,50,0.9)';
      ctx.lineWidth = Math.max(2.5, geo.cell * 0.09);
      ctx.strokeRect(hf.x - geo.cell / 2 + 2, hf.y - geo.cell / 2 + 2, geo.cell - 4, geo.cell - 4);
      ctx.strokeRect(ht.x - geo.cell / 2 + 2, ht.y - geo.cell / 2 + 2, geo.cell - 4, geo.cell - 4);
    }

    // 可行走提示点
    if (ui.selected >= 0 && !ui.thinking) {
      for (var i = 0; i < ui.legalFrom.length; i++) {
        var mv = ui.legalFrom[i];
        var pr = l2s((mv.t / 9) | 0, mv.t % 9);
        if (mv.captured) {
          ctx.beginPath();
          ctx.arc(pr.x, pr.y, geo.cell * 0.36, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(200,64,42,0.85)';
          ctx.lineWidth = Math.max(2, geo.cell * 0.06);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(pr.x, pr.y, geo.cell * 0.13, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(36,110,58,0.6)';
          ctx.fill();
        }
      }
    }

    // 被将军红圈
    var st = X.gameStatus(ui.game);
    if (st.inCheck && !st.over) {
      var ksq = ui.game.kg[ui.game.side];
      var kp = l2s((ksq / 9) | 0, ksq % 9);
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, geo.cell * 0.5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(224,70,50,0.95)';
      ctx.lineWidth = Math.max(3, geo.cell * 0.1);
      ctx.stroke();
    }

    // 棋子
    for (var sq = 0; sq < 90; sq++) {
      var v = b[sq];
      if (!v) continue;
      var isSel = sq === ui.selected;
      var isDrag = ui.drag && ui.drag.from === sq;
      if (isDrag && ui.drag.release) continue;
      drawPiece(sq, v, isDrag ? 0.55 : 1, isSel || isDrag ? 1.08 : 1, isSel);
    }

    // 拖动中的棋子
    if (ui.drag) {
      var dg = ctx.createRadialGradient(ui.drag.x, ui.drag.y, 2, ui.drag.x, ui.drag.y, geo.cell * 0.45);
      ctx.beginPath();
      ctx.arc(ui.drag.x, ui.drag.y, geo.cell * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fill();
      drawPieceAtXY(ui.drag.x, ui.drag.y, b[ui.drag.from], 0.92, 1.12);
    }

    // 调试模式：网格交点十字
    if (DEBUG) {
      ctx.strokeStyle = '#ff2222';
      ctx.lineWidth = 2;
      for (var dr = 0; dr <= 9; dr++) {
        for (var dc = 0; dc <= 8; dc++) {
          var p = l2s(dr, dc);
          ctx.beginPath();
          ctx.moveTo(p.x - 6, p.y); ctx.lineTo(p.x + 6, p.y);
          ctx.moveTo(p.x, p.y - 6); ctx.lineTo(p.x, p.y + 6);
          ctx.stroke();
        }
      }
    }
  }

  function drawPieceAtXY(x, y, piece, alpha, scale) {
    var rad = geo.cell * 0.42 * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    var g = ctx.createRadialGradient(x - rad * 0.35, y - rad * 0.4, rad * 0.15, x, y, rad);
    g.addColorStop(0, '#fbf3e0');
    g.addColorStop(0.75, '#f2e3bd');
    g.addColorStop(1, '#e9d7ae');
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(1.2, geo.cell * 0.04);
    ctx.strokeStyle = 'rgba(92,66,34,0.8)';
    ctx.stroke();
    var code = piece > 0 ? piece : -piece;
    var ch = piece > 0 ? RED_NAME[code - 1] : BLACK_NAME[code - 1];
    ctx.font = '700 ' + Math.round(geo.cell * 0.54) + 'px "STKaiti","KaiTi","SimSun","Noto Serif SC",serif';
    ctx.fillStyle = piece > 0 ? '#a92b1d' : '#27221b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, x, y + geo.cell * 0.02);
    ctx.restore();
  }

  /* ---------------- 触摸交互 ---------------- */
  var downInfo = null;

  function onDown(e) {
    if (e.target !== canvas) return;
    e.preventDefault();
    Sound.unlock();
    if (!inStage(e.clientX, e.clientY)) return;
    var p = stageXY(e.clientX, e.clientY);
    var sq = s2l(p.x, p.y);
    if (sq === null) return;
    downInfo = { x: e.clientX, y: e.clientY, sq: sq, moved: false, dragging: false };
    canvas.setPointerCapture(e.pointerId);
  }

  function onMove(e) {
    if (!downInfo || e.target !== canvas) return;
    e.preventDefault();
    var dx = e.clientX - downInfo.x, dy = e.clientY - downInfo.y;
    if (!downInfo.moved && (dx * dx + dy * dy) > 36) downInfo.moved = true;
    if (downInfo.sq >= 0 && canPick(downInfo.sq) && !ui.thinking) {
      downInfo.dragging = true;
      var p = stageXY(e.clientX, e.clientY);
      ui.drag = { from: downInfo.sq, x: p.x, y: p.y };
      draw();
    } else if (ui.drag) {
      var p2 = stageXY(e.clientX, e.clientY);
      ui.drag.x = p2.x; ui.drag.y = p2.y;
      draw();
    }
  }

  function onUp(e) {
    if (!downInfo) return;
    var d = downInfo;
    downInfo = null;
    if (e.target !== canvas) return;
    e.preventDefault();
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}

    var p = stageXY(e.clientX, e.clientY);
    var sq = s2l(p.x, p.y);

    if (ui.drag) {
      ui.drag.release = true;
      var from = ui.drag.from;
      ui.drag = null;
      draw();
      if (sq !== null && sq !== from) {
        if (tryMove(from, sq, true)) return;
        if (isOwnPiece(sq)) { select(sq); return; }
      }
      clearSelect();
      return;
    }

    // 点击（未拖动）
    if (!d.moved && d.sq !== null) {
      if (ui.thinking || overShown()) return;
      if (ui.selected >= 0) {
        if (d.sq === ui.selected) { clearSelect(); return; }
        if (tryMove(ui.selected, d.sq, false)) return;
        if (isOwnPiece(d.sq)) { select(d.sq); return; }
        clearSelect();
      } else {
        select(d.sq);
      }
    }
  }

  function canPick(sq) {
    if (ui.thinking || overShown()) return false;
    if (ui.game.side !== ui.humanSide) return false;
    var v = ui.game.board[sq];
    return v !== 0 && (v < 0 ? -1 : 1) === ui.humanSide;
  }

  function isOwnPiece(sq) {
    var v = ui.game.board[sq];
    return v !== 0 && (v < 0 ? -1 : 1) === ui.humanSide;
  }

  function select(sq) {
    ui.selected = sq;
    ui.legalFrom = legalTargets(sq);
    Sound.tick();
    draw();
  }
  function clearSelect() {
    ui.selected = -1;
    ui.legalFrom = [];
    draw();
  }
  function legalTargets(sq) {
    var out = [];
    var mv = X.legalMoves(ui.game, ui.humanSide);
    for (var i = 0; i < mv.length; i++) if (mv[i].f === sq) out.push(mv[i]);
    return out;
  }

  /* ---------------- 走子流程 ---------------- */
  function overShown() { return ui.game.result !== null; }

  function tryMove(from, to, fromDrag) {
    if (ui.game.side !== ui.humanSide) return false;
    if (from < 0) return false;
    var mv = null;
    for (var i = 0; i < ui.legalFrom.length; i++) {
      if (ui.legalFrom[i].t === to) { mv = ui.legalFrom[i]; break; }
    }
    if (!mv) return false;
    applyMove(mv);
    return true;
  }

  function applyMove(mv) {
    clearSelect();
    var wasCapture = !!mv.captured;
    X.make(ui.game, mv, true);
    ui.game.side = ui.game.side === RED ? BLACK : RED;
    ui.lastMove = { f: mv.f, t: mv.t };
    var st = X.gameStatus(ui.game);
    if (wasCapture) Sound.capture(); else Sound.move();
    if (st.inCheck) Sound.check();
    draw();
    if (st.over) { showResult(st); return; }
    if (ui.game.side !== ui.humanSide) scheduleAI();
    updateStatus();
    publishDebug();
  }

  function scheduleAI() {
    if (ui.game.side === ui.humanSide) return;
    if (ui.game.result) return;
    ui.thinking = true;
    var token = ++ui.thinkToken;
    updateStatus();
    setTimeout(function () {
      if (token !== ui.thinkToken) return;
      var cfg = X.LEVELS[ui.levelIdx];
      var mv = X.searchBest(ui.game, cfg);
      if (token !== ui.thinkToken) return;
      ui.thinking = false;
      if (!mv) {   // AI 无棋可走（防御：应已被判胜负）
        var st2 = X.gameStatus(ui.game);
        if (st2.over) showResult(st2);
        return;
      }
      var wasCapture = !!mv.captured;
      X.make(ui.game, mv, true);
      ui.game.side = ui.game.side === RED ? BLACK : RED;
      ui.lastMove = { f: mv.f, t: mv.t };
      var st = X.gameStatus(ui.game);
      if (wasCapture) Sound.capture(); else Sound.move();
      if (st.inCheck) Sound.check();
      draw();
      if (st.over) { showResult(st); return; }
      updateStatus();
      publishDebug();
    }, 30);
  }

  /* ---------------- 状态栏 / 结算 ---------------- */
  function sideName(side) { return side === RED ? '红方' : '黑方'; }

  function updateStatus() {
    if (ui.thinking) {
      statusText.textContent = (ui.game.side === RED ? '红方' : '黑方') + '思考中';
      statusText.className = '';
      thinkDot.classList.remove('hidden');
      return;
    }
    thinkDot.classList.add('hidden');
    var st = X.gameStatus(ui.game);
    statusText.className = st.inCheck ? 'check' : '';
    if (st.inCheck) statusText.textContent = '将军！' + (ui.game.side === ui.humanSide ? '轮到你了' : '轮到 ' + sideName(ui.game.side));
    else statusText.textContent = ui.game.side === ui.humanSide ? '轮到你 · ' + sideName(ui.humanSide) : '轮到 ' + sideName(ui.game.side);
  }

  function showResult(st) {
    ui.thinking = false;
    var won = st.winner === ui.humanSide;
    if (st.result === 'draw') {
      resTitle.textContent = '和棋';
      resDesc.textContent = '相同局面重复出现 3 次，判和。\n当前难度：' + X.LEVELS[ui.levelIdx].name;
      Sound.draw();
    } else if (won) {
      resTitle.textContent = '你赢了！';
      resDesc.textContent = (st.result === 'checkmate' ? '将死对方' : '对方无路可走') + '，恭喜获胜！\n当前难度：' + X.LEVELS[ui.levelIdx].name;
      Sound.win();
    } else {
      resTitle.textContent = '你输了';
      resDesc.textContent = (st.result === 'checkmate' ? '你被将死' : '你无路可走') + '。\n可以试试换低一档难度，或悔棋复盘。';
      Sound.lose();
    }
    overlay.hidden = false;
    draw();
  }

  function hideResult() { overlay.hidden = true; }

  /* ---------------- 悔棋 / 提示 / 重开 ---------------- */
  function undo() {
    if (ui.thinking) {
      ui.thinkToken++;
      ui.thinking = false;
    }
    clearHint();
    clearSelect();
    var pops = 0;
    while (ui.game.history.length && ui.game.side !== ui.humanSide && pops < 2) {
      var mv = ui.game.history[ui.game.history.length - 1];
      X.unmake(ui.game, mv, true);
      ui.game.side = ui.game.side === RED ? BLACK : RED;
      pops++;
    }
    if (!pops) { flashStatus('没有可悔的棋'); return; }
    if (ui.game.result) ui.game.result = null;
    ui.lastMove = ui.game.history.length ? { f: ui.game.history[ui.game.history.length - 1].f, t: ui.game.history[ui.game.history.length - 1].t } : null;
    hideResult();
    Sound.tick();
    updateStatus();
    draw();
    publishDebug();
    if (ui.game.side !== ui.humanSide && !ui.game.result) scheduleAI();
  }

  function flashStatus(msg) {
    statusText.textContent = msg;
    statusText.className = '';
    thinkDot.classList.add('hidden');
  }

  function doHint() {
    if (ui.thinking || ui.game.result || ui.game.side !== ui.humanSide) return;
    clearHint();
    // 提示棋力封顶为“普通”档（最多 3 层搜索）且带随机性，
    // 确保提示永远不比 AI 更准（困难/大师/宗师档 AI 深度 ≥4 层，天然强于提示）
    var cfg = {
      maxDepth: Math.min(ui.levelIdx, 3),
      time: 0.6,
      margin: 30,
      qsearch: false,
      random: false
    };
    var mv = X.searchBest(ui.game, cfg);
    if (!mv) return;
    ui.hint = { f: mv.f, t: mv.t, timer: 0 };
    var clearT = setTimeout(function () {
      ui.hint = null;
      draw();
    }, 2200);
    ui.hint.timer = clearT;
    Sound.tick();
    draw();
  }

  function clearHint() {
    if (ui.hint) { clearTimeout(ui.hint.timer); ui.hint = null; }
  }

  function newGame() {
    ui.thinkToken++;
    ui.thinking = false;
    clearHint();
    ui.game = X.createGame();
    ui.selected = -1;
    ui.legalFrom = [];
    ui.lastMove = null;
    hideResult();
    ui.overShown = false;
    ui.flipped = ui.humanSide === BLACK;
    draw();
    updateStatus();
    publishDebug();
    if (ui.game.side !== ui.humanSide) scheduleAI();
  }

  /* ---------------- 难度与阵营 ---------------- */
  function setLevel(idx) {
    ui.levelIdx = idx;
    localStorage.setItem('xj_level', String(idx));
    var btns = document.querySelectorAll('#levels .lvl');
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('active', i === idx);
    publishDebug();
  }
  function setSide(side) {
    ui.humanSide = side;
    localStorage.setItem('xj_side', side === RED ? 'R' : 'B');
    document.getElementById('btnSideRed').classList.toggle('active', side === RED);
    document.getElementById('btnSideBlack').classList.toggle('active', side === BLACK);
    newGame();
  }

  /* ---------------- 音效（WebAudio，无资源文件） ---------------- */
  var Sound = {
    ctx: null,
    unlock: function () {
      if (!this.ctx) {
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; }
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    tone: function (freq, dur, type, vol, when) {
      if (!ui.soundOn) return;
      if (!this.ctx) return;
      var t = this.ctx.currentTime + (when || 0);
      var o = this.ctx.createOscillator();
      var g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + dur + 0.05);
    },
    tick: function () { this.tone(700, 0.05, 'triangle', 0.08); },
    move: function () { this.tone(330, 0.07, 'triangle', 0.2); },
    capture: function () { this.tone(170, 0.12, 'square', 0.16); this.tone(120, 0.1, 'square', 0.12, 0.03); },
    check: function () { this.tone(540, 0.1, 'sine', 0.16); this.tone(410, 0.14, 'sine', 0.14, 0.11); },
    win: function () { this.tone(523, 0.12, 'triangle', 0.16); this.tone(659, 0.12, 'triangle', 0.16, 0.12); this.tone(784, 0.2, 'triangle', 0.16, 0.24); },
    lose: function () { this.tone(392, 0.14, 'triangle', 0.14); this.tone(330, 0.14, 'triangle', 0.14, 0.14); this.tone(262, 0.26, 'triangle', 0.14, 0.28); },
    draw: function () { this.tone(440, 0.12, 'triangle', 0.14); this.tone(440, 0.16, 'triangle', 0.14, 0.14); }
  };

  /* ---------------- 挂接事件 ---------------- */
  function bind() {
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    var levels = document.querySelectorAll('#levels .lvl');
    for (var i = 0; i < levels.length; i++) {
      (function (idx) {
        levels[i].addEventListener('click', function () { setLevel(idx); });
      })(i);
    }
    document.getElementById('btnSideRed').addEventListener('click', function () { setSide(RED); });
    document.getElementById('btnSideBlack').addEventListener('click', function () { setSide(BLACK); });
    document.getElementById('btnUndo').addEventListener('click', undo);
    document.getElementById('btnHint').addEventListener('click', doHint);
    document.getElementById('btnRestart').addEventListener('click', newGame);
    document.getElementById('btnSound').addEventListener('click', function () {
      ui.soundOn = !ui.soundOn;
      localStorage.setItem('xj_sound', ui.soundOn ? '1' : '0');
      this.textContent = '音效 ' + (ui.soundOn ? '开' : '关');
      if (ui.soundOn) Sound.tick();
    });
    document.getElementById('resAgain').addEventListener('click', newGame);
    document.getElementById('resSwap').addEventListener('click', function () {
      setSide(ui.humanSide === RED ? BLACK : RED);
    });
    document.getElementById('resClose').addEventListener('click', hideResult);

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    if (window.ResizeObserver) {
      new ResizeObserver(onResize).observe(stage);
    }
  }

  function onResize() {
    layout();
    draw();
    publishDebug();
  }

  /* ---------------- 启动 ---------------- */
  var DEBUG = /[?&]debug=1/.test(location.search);
  function publishDebug() {
    if (!DEBUG) return;
    if (!ui.game) return;   // boot 阶段尚未建局
    var dv = document.getElementById('debugInfo');
    if (!dv) {
      dv = document.createElement('div');
      dv.id = 'debugInfo';
      dv.setAttribute('style', 'position:fixed;top:0;left:0;z-index:999;color:#0f0;font:11px monospace;background:rgba(0,0,0,.7);padding:2px 6px;pointer-events:none');
      document.body.appendChild(dv);
    }
    var r = canvas.getBoundingClientRect();
    var st = X.gameStatus(ui.game);
    var pieces = [];
    for (var sq = 0; sq < 90; sq++) {
      if (ui.game.board[sq] !== 0) pieces.push(sq + ':' + ui.game.board[sq]);
    }
    dv.textContent = JSON.stringify({
      canvasCSS: { w: canvas.clientWidth, h: canvas.clientHeight },
      canvasRect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      geo: geo,
      dpr: window.devicePixelRatio,
      humanSide: ui.humanSide === RED ? 'R' : 'B',
      flipped: ui.flipped,
      viewport: innerWidth + 'x' + innerHeight,
      state: {
        side: ui.game.side === RED ? 'R' : 'B',
        history: ui.game.history.length,
        result: st.result,
        winner: st.winner,
        inCheck: st.inCheck,
        selected: ui.selected,
        thinking: ui.thinking,
        level: ui.levelIdx,
        tick: window.__autoStep || 0,
        pieces: pieces.join(',')
      }
    });
  }

  /* 自走测试脚本：?autoplay=1（调试模式下）走完整对局流程 */
  function runAutoplay() {
    var RED2 = X.RED, BLACK2 = X.BLACK;
    var seq = [
      { act: 'side', side: RED2 },          // 执红，重置
      { act: 'move', f: 64, t: 67 },        // 炮二平五（(7,1)→(7,4)）
      { act: 'waitAI' },
      { act: 'undo' },                      // 悔棋（AI+己方）
      { act: 'level', lv: 3 },
      { act: 'hint' },
      { act: 'move', f: 64, t: 67 },        // 再走中炮
      { act: 'waitAI' },
      { act: 'undo' },                      // 再悔
      { act: 'side', side: BLACK2 },        // 换执黑 → AI 红先行
      { act: 'waitAI' },                    // AI 开局走子
      { act: 'undo' },                      // 悔 AI 首着 → AI 重走
      { act: 'waitAI' }
    ];
    var step = 0;
    window.__autoStep = step;
    window.__autoErr = null;
    var iv = setInterval(function () {
      if (ui.thinking) return;
      if (step >= seq.length) { clearInterval(iv); return; }
      var s = seq[step];
      if (s.act === 'waitAI') { if (ui.game.side !== ui.humanSide) return; }
      try {
        if (s.act === 'side') { window.__debug.setSide(s.side); }
        else if (s.act === 'move') { window.__debug.playerMove(s.f, s.t); }
        else if (s.act === 'undo') { window.__debug.undo(); }
        else if (s.act === 'hint') { var H = X.LEVELS[Math.min(4, ui.levelIdx + 1)]; X.searchBest(ui.game, H); }
        else if (s.act === 'level') { window.__debug.level(s.lv); }
      } catch (e) { window.__autoErr = String(e); clearInterval(iv); return; }
      window.__autoStep = ++step;
      publishDebug();
    }, 900);
  }

  function boot() {
    var soundBtn = document.getElementById('btnSound');
    soundBtn.textContent = '音效 ' + (ui.soundOn ? '开' : '关');
    setLevel(ui.levelIdx);
    document.getElementById('btnSideRed').classList.toggle('active', ui.humanSide === RED);
    document.getElementById('btnSideBlack').classList.toggle('active', ui.humanSide === BLACK);
    bind();
    newGame();
    layout();
    draw();
    publishDebug();
    if (/[?&]autoplay=1/.test(location.search)) setTimeout(runAutoplay, 1500);
    if (/[?&]over=1/.test(location.search)) {
      setTimeout(function () {
        showResult({ result: 'checkmate', winner: RED });
      }, 800);
    }
    if (location.protocol.indexOf('http') === 0 && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  boot();

  /* 测试/调试接口 */
  window.__debug = {
    ui: ui,
    game: function () { return ui.game; },
    playerMove: function (f, t) {
      ui.selected = f;
      ui.legalFrom = legalTargets(f);
      return tryMove(f, t, true);
    },
    level: function (i) { setLevel(i); },
    setSide: setSide,
    status: function () { return X.gameStatus(ui.game); },
    geo: function () { return geo; },
    undo: undo
  };
})();