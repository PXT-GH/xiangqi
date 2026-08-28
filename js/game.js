/* ============================================================
 * 中国象棋 · 核心规则与人工智能（纯逻辑，无 DOM）
 * 坐标约定：row 0 = 黑方底线（棋盘上方），row 9 = 红方底线
 *           棋盘 10 行 × 9 列，双方 5 个兵卒
 * 棋子编码：红方为正、黑方为负；K=1 帅/将 A=2 仕/士 B=3 相/象
 *           N=4 马 R=5 车 C=6 炮 P=7 兵/卒
 * ============================================================ */
(function (global) {
  'use strict';

  var K = 1, A = 2, B = 3, N = 4, R = 5, C = 6, P = 7;
  var RED = 1, BLACK = -1;
  var ROWS = 10, COLS = 9, SQ = 90;
  var EMPTY = 0;

  var PIECE_NAME = ['', '帅', '仕', '相', '马', '车', '炮', '兵'];
  var PIECE_NAME_B = ['', '将', '士', '象', '马', '车', '炮', '卒'];
  // 基础子力价值（吃子排序用，帅等 10000）
  var VALUE = [0, 10000, 200, 200, 400, 900, 450, 100];

  var MATE = 100000, INF = 1 << 30;

  /* ---------------- 开局盘面 ---------------- */
  function buildInitBoard() {
    var b = new Int8Array(SQ);
    var backB = [R, N, B, A, K, A, B, N, R];
    for (var c = 0; c < 9; c++) b[c] = -backB[c];            // row 0
    b[2 * 9 + 1] = -C; b[2 * 9 + 7] = -C;                     // 黑炮
    for (var c = 0; c < 9; c += 2) b[3 * 9 + c] = -P;         // 黑卒
    for (var c = 0; c < 9; c += 2) b[6 * 9 + c] = P;          // 红兵
    b[7 * 9 + 1] = C; b[7 * 9 + 7] = C;                       // 红炮
    var backR = [R, N, B, A, K, A, B, N, R];
    for (var c = 0; c < 9; c++) b[9 * 9 + c] = backR[c];      // row 9
    return b;
  }

  /* ---------------- 对局状态 ---------------- */
  function createGame() {
    var g = {
      board: buildInitBoard(),
      side: RED,                 // 当前行棋方
      kg: { 1: 9 * 9 + 4, [-1]: 4 },  // 双方将军位置
      history: [],               // {f,t,piece,captured,key}
      rep: new Map(),            // 局面 key -> 出现次数
      reps: 3,                   // 同一局面第 3 次出现判和
      result: null,              // 'checkmate' | 'stalemate' | 'draw'
      winner: null               // 胜方（红/黑）
    };
    g.rep.set(keyOf(g), 1);   // 初始局面计一次，相同局面出现第 3 次判和
    return g;
  }

function keyOfParts(board, side) {
  return board.join(',') + '|' + (side === RED ? 'R' : 'B');
}
function keyOf(s) {
  return keyOfParts(s.board, s.side);
}

  /* ---------------- 基础判定 ---------------- */
  function inPalace(side, r, c) {
    if (c < 3 || c > 5) return false;
    return side === RED ? (r >= 7 && r <= 9) : (r >= 0 && r <= 2);
  }
  function crossedRiver(side, r) {   // 兵卒是否已过河
    return side === RED ? r <= 4 : r >= 5;
  }
  function inOwnHalf(side, r) {      // 象的落点必须在己方半场
    return side === RED ? r >= 5 : r <= 4;
  }

  /* ---------------- 走法生成（伪合法） ---------------- */
  function genAll(s, side) {
    var b = s.board, moves = [];
    var dr, dc, r2, c2, i, rr, cc;
    for (var sq = 0; sq < SQ; sq++) {
      var v = b[sq];
      if (v === 0 || (v < 0 ? -1 : 1) !== side) continue;
      var code = v < 0 ? -v : v;
      var r = (sq / 9) | 0, c = sq % 9;

      if (code === K) {
        for (i = 0; i < 4; i++) {
          dr = (i === 0 ? -1 : i === 1 ? 1 : 0); dc = (i === 2 ? -1 : i === 3 ? 1 : 0);
          r2 = r + dr; c2 = c + dc;
          if (r2 < 0 || r2 > 9 || c2 < 0 || c2 > 8) continue;
          if (!inPalace(side, r2, c2)) continue;
          var t2 = b[r2 * 9 + c2];
          if (t2 === 0) moves.push({ f: sq, t: r2 * 9 + c2, piece: v, captured: 0 });
          else if ((t2 < 0 ? -1 : 1) !== side && (t2 < 0 ? -t2 : t2) !== K)
            moves.push({ f: sq, t: r2 * 9 + c2, piece: v, captured: t2 });
        }
      } else if (code === A) {
        for (i = 0; i < 4; i++) {
          dr = (i === 0 ? -1 : i === 1 ? 1 : i === 2 ? -1 : 1);
          dc = (i === 0 ? -1 : i === 1 ? 1 : i === 2 ? 1 : -1);
          r2 = r + dr; c2 = c + dc;
          if (r2 < 0 || r2 > 9 || c2 < 0 || c2 > 8) continue;
          if (!inPalace(side, r2, c2)) continue;
          var t3 = b[r2 * 9 + c2];
          if (t3 === 0) moves.push({ f: sq, t: r2 * 9 + c2, piece: v, captured: 0 });
          else if ((t3 < 0 ? -1 : 1) !== side && (t3 < 0 ? -t3 : t3) !== K)
            moves.push({ f: sq, t: r2 * 9 + c2, piece: v, captured: t3 });
        }
      } else if (code === B) {
        for (i = 0; i < 4; i++) {
          dr = (i === 0 ? -2 : i === 1 ? 2 : i === 2 ? -2 : 2);
          dc = (i === 0 ? -2 : i === 1 ? 2 : i === 2 ? 2 : -2);
          r2 = r + dr; c2 = c + dc;
          if (r2 < 0 || r2 > 9 || c2 < 0 || c2 > 8) continue;
          if (!inOwnHalf(side, r2)) continue;
          if (b[(r + dr / 2) * 9 + (c + dc / 2)] !== 0) continue;  // 象眼
          var t4 = b[r2 * 9 + c2];
          if (t4 === 0) moves.push({ f: sq, t: r2 * 9 + c2, piece: v, captured: 0 });
          else if ((t4 < 0 ? -1 : 1) !== side && (t4 < 0 ? -t4 : t4) !== K)
            moves.push({ f: sq, t: r2 * 9 + c2, piece: v, captured: t4 });
        }
      } else if (code === N) {
        var offs = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
        for (i = 0; i < 8; i++) {
          r2 = r + offs[i][0]; c2 = c + offs[i][1];
          if (r2 < 0 || r2 > 9 || c2 < 0 || c2 > 8) continue;
          var lr = Math.abs(offs[i][0]) === 2 ? r + offs[i][0] / 2 : r;
          var lc = Math.abs(offs[i][1]) === 2 ? c + offs[i][1] / 2 : c;
          if (b[lr * 9 + lc] !== 0) continue;   // 蹩马腿
          var t5 = b[r2 * 9 + c2];
          if (t5 === 0) moves.push({ f: sq, t: r2 * 9 + c2, piece: v, captured: 0 });
          else if ((t5 < 0 ? -1 : 1) !== side && (t5 < 0 ? -t5 : t5) !== K)
            moves.push({ f: sq, t: r2 * 9 + c2, piece: v, captured: t5 });
        }
      } else if (code === R || code === C) {
        var dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (i = 0; i < 4; i++) {
          rr = r + dirs[i][0]; cc = c + dirs[i][1];
          var screen = 0;
          while (rr >= 0 && rr <= 9 && cc >= 0 && cc <= 8) {
            var t6 = b[rr * 9 + cc];
            if (code === R) {
              if (t6 !== 0) {
                if ((t6 < 0 ? -1 : 1) !== side && (t6 < 0 ? -t6 : t6) !== K)
                  moves.push({ f: sq, t: rr * 9 + cc, piece: v, captured: t6 });
                break;
              }
              moves.push({ f: sq, t: rr * 9 + cc, piece: v, captured: 0 });
            } else { // 炮
              if (t6 !== 0) {
                screen++;
                if (screen === 2) {
                  if ((t6 < 0 ? -1 : 1) !== side && (t6 < 0 ? -t6 : t6) !== K)
                    moves.push({ f: sq, t: rr * 9 + cc, piece: v, captured: t6 });
                  break;
                }
              } else if (screen === 0) {
                moves.push({ f: sq, t: rr * 9 + cc, piece: v, captured: 0 });
              }
            }
            rr += dirs[i][0]; cc += dirs[i][1];
          }
        }
      } else if (code === P) {
        // 前进一格
        var fr = r + (side === RED ? -1 : 1);
        if (fr >= 0 && fr <= 9) {
          var t7 = b[fr * 9 + c];
          if (t7 === 0) moves.push({ f: sq, t: fr * 9 + c, piece: v, captured: 0 });
          else if ((t7 < 0 ? -1 : 1) !== side && (t7 < 0 ? -t7 : t7) !== K)
            moves.push({ f: sq, t: fr * 9 + c, piece: v, captured: t7 });
        }
        // 过河后横走
        if (crossedRiver(side, r)) {
          for (i = -1; i <= 1; i += 2) {
            var cc2 = c + i;
            if (cc2 < 0 || cc2 > 8) continue;
            var t8 = b[r * 9 + cc2];
            if (t8 === 0) moves.push({ f: sq, t: r * 9 + cc2, piece: v, captured: 0 });
            else if ((t8 < 0 ? -1 : 1) !== side && (t8 < 0 ? -t8 : t8) !== K)
              moves.push({ f: sq, t: r * 9 + cc2, piece: v, captured: t8 });
          }
        }
      }
    }
    return moves;
  }

  /* ---------------- 攻击判定（用于将军检测） ----------------
   * 判断 sq 是否处于 bySide 方棋子的攻击之下
   */
  function isAttacked(b, bySide, sq) {
    var r = (sq / 9) | 0, c = sq % 9;
    var i, rr, cc;

    // 兵/卒
    if (bySide === RED) {
      if (r + 1 <= 9) { var p1 = b[(r + 1) * 9 + c]; if (p1 === P) return true; }
      if (r <= 4) {
        if (c - 1 >= 0 && b[r * 9 + (c - 1)] === P) return true;
        if (c + 1 <= 8 && b[r * 9 + (c + 1)] === P) return true;
      }
    } else {
      if (r - 1 >= 0) { var p2 = b[(r - 1) * 9 + c]; if (p2 === -P) return true; }
      if (r >= 5) {
        if (c - 1 >= 0 && b[r * 9 + (c - 1)] === -P) return true;
        if (c + 1 <= 8 && b[r * 9 + (c + 1)] === -P) return true;
      }
    }

    // 马
    var offs = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
    for (i = 0; i < 8; i++) {
      rr = r + offs[i][0]; cc = c + offs[i][1];
      if (rr < 0 || rr > 9 || cc < 0 || cc > 8) continue;
      var lr = Math.abs(offs[i][0]) === 2 ? r + offs[i][0] / 2 : r;
      var lc = Math.abs(offs[i][1]) === 2 ? c + offs[i][1] / 2 : c;
      if (b[lr * 9 + lc] !== 0) continue;
      var h = b[rr * 9 + cc];
      if ((bySide === RED ? h === N : h === -N)) return true;
    }

    // 相/象（眼须为空，且攻击者须在己方半场）
    for (i = 0; i < 4; i++) {
      var dr = (i === 0 ? -2 : i === 1 ? 2 : i === 2 ? -2 : 2);
      var dc = (i === 0 ? -2 : i === 1 ? 2 : i === 2 ? 2 : -2);
      rr = r + dr; cc = c + dc;
      if (rr < 0 || rr > 9 || cc < 0 || cc > 8) continue;
      if (!inOwnHalf(bySide, rr)) continue;
      if (b[(r + dr / 2) * 9 + (c + dc / 2)] !== 0) continue;
      var el = b[rr * 9 + cc];
      if ((bySide === RED ? el === B : el === -B)) return true;
    }

    // 仕/士
    for (i = 0; i < 4; i++) {
      var adr = (i === 0 ? -1 : i === 1 ? 1 : i === 2 ? -1 : 1);
      var adc = (i === 0 ? -1 : i === 1 ? 1 : i === 2 ? 1 : -1);
      rr = r + adr; cc = c + adc;
      if (rr < 0 || rr > 9 || cc < 0 || cc > 8) continue;
      if (!inPalace(bySide, rr, cc)) continue;
      var ad = b[rr * 9 + cc];
      if ((bySide === RED ? ad === A : ad === -A)) return true;
    }

    // 将军照面（含飞将）：四个方向第一条线上的第一枚棋子若是对方将/帅则可攻击
    var dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (i = 0; i < 4; i++) {
      rr = r + dirs[i][0]; cc = c + dirs[i][1];
      while (rr >= 0 && rr <= 9 && cc >= 0 && cc <= 8) {
        var t = b[rr * 9 + cc];
        if (t !== 0) {
          if (bySide === RED ? t === K : t === -K) return true;
          break;
        }
        rr += dirs[i][0]; cc += dirs[i][1];
      }
    }

    // 车
    for (i = 0; i < 4; i++) {
      rr = r + dirs[i][0]; cc = c + dirs[i][1];
      while (rr >= 0 && rr <= 9 && cc >= 0 && cc <= 8) {
        var t = b[rr * 9 + cc];
        if (t !== 0) {
          if (bySide === RED ? t === R : t === -R) return true;
          break;
        }
        rr += dirs[i][0]; cc += dirs[i][1];
      }
    }

    // 炮：炮架一枚，隔子打第二枚
    for (i = 0; i < 4; i++) {
      rr = r + dirs[i][0]; cc = c + dirs[i][1];
      var cnt = 0;
      while (rr >= 0 && rr <= 9 && cc >= 0 && cc <= 8) {
        var t = b[rr * 9 + cc];
        if (t !== 0) {
          cnt++;
          if (cnt === 2) {
            if (bySide === RED ? t === C : t === -C) return true;
            break;
          }
        }
        rr += dirs[i][0]; cc += dirs[i][1];
      }
    }
    return false;
  }

  /* ---------------- 走子（可撤销） ---------------- */
  function make(s, mv, record) {
    s.board[mv.t] = mv.piece;
    s.board[mv.f] = 0;
    var code = mv.piece < 0 ? -mv.piece : mv.piece;
    if (code === K) {
      var r = (mv.t / 9) | 0, c = mv.t % 9;
      s.kg[mv.piece > 0 ? 1 : -1] = mv.t;
    }
    if (record) {
      // 局面 key 须以“轮到行棋的一方”为准（与 gameStatus 一致）
      var nextSide = s.side === RED ? BLACK : RED;
      var key = keyOfParts(s.board, nextSide);
      mv.key = key;
      s.history.push(mv);
      s.rep.set(key, (s.rep.get(key) || 0) + 1);
    }
  }

  function unmake(s, mv, record) {
    s.board[mv.f] = mv.piece;
    s.board[mv.t] = mv.captured;
    var code = mv.piece < 0 ? -mv.piece : mv.piece;
    if (code === K) {
      s.kg[mv.piece > 0 ? 1 : -1] = mv.f;
    }
    if (record) {
      s.history.pop();
      var n = s.rep.get(mv.key) - 1;
      if (n <= 0) s.rep.delete(mv.key); else s.rep.set(mv.key, n);
    }
  }

  /* ---------------- 合法走法（去将/飞将过滤） ---------------- */
  function legalMoves(s, side) {
    side = side || s.side;
    var pseudo = genAll(s, side);
    var other = side === RED ? BLACK : RED;
    var out = [];
    for (var i = 0; i < pseudo.length; i++) {
      var mv = pseudo[i];
      make(s, mv, false);
      var ok = !isAttacked(s.board, other, s.kg[side]);
      unmake(s, mv, false);
      if (ok) out.push(mv);
    }
    return out;
  }

  function isInCheck(s, side) {
    side = side || s.side;
    return isAttacked(s.board, side === RED ? BLACK : RED, s.kg[side]);
  }

  /* ---------------- 局面状态 ---------------- */
  function gameStatus(s) {
    var st = { over: false, result: null, winner: null, inCheck: isInCheck(s) };
    if (s.result) {
      st.over = true; st.result = s.result; st.winner = s.winner;
      return st;
    }
    if (legalMoves(s).length === 0) {
      st.over = true;
      st.result = st.inCheck ? 'checkmate' : 'stalemate';
      st.winner = s.side === RED ? BLACK : RED;
      return st;
    }
    var key = keyOf(s);
    if ((s.rep.get(key) || 0) >= s.reps) {
      st.over = true; st.result = 'draw';
    }
    return st;
  }

  /* ============================================================
   * 局面评估：子力 + 位置价值（红方为正）
   * 位置表按红方视角编写，黑方镜像（row 与 col 同时翻转）
   * ============================================================ */
  var PST_R = [
    [-6, -4, -2, 0, 0, -2, -4, -6, -6],
    [-4, -2, 0, 2, 2, 0, -2, -4, -4],
    [-2, 0, 2, 4, 4, 2, 0, -2, -2],
    [0, 2, 4, 6, 6, 4, 2, 0, 0],
    [0, 2, 4, 6, 6, 4, 2, 0, 0],
    [0, 2, 4, 6, 6, 4, 2, 0, 0],
    [-2, 0, 2, 4, 4, 2, 0, -2, -2],
    [-4, -2, 0, 2, 2, 0, -2, -4, -4],
    [-4, -2, 0, 0, 0, 0, -2, -4, -4],
    [-6, -4, -2, 0, 0, -2, -4, -6, -6]
  ];
  var PST_N = [
    [-6, -4, -2, 0, 2, 0, -2, -4, -6],
    [-4, -2, 0, 4, 4, 4, 0, -2, -4],
    [-2, 0, 2, 8, 6, 8, 2, 0, -2],
    [0, 2, 6, 10, 10, 10, 6, 2, 0],
    [0, 4, 6, 12, 12, 12, 6, 4, 0],
    [-2, 2, 4, 10, 12, 10, 4, 2, -2],
    [-4, -2, 0, 6, 8, 6, 0, -2, -4],
    [-6, -4, -2, 0, 4, 0, -2, -4, -6],
    [-8, -6, -4, -2, 0, -2, -4, -6, -8],
    [-10, -8, -6, -4, -4, -4, -6, -8, -10]
  ];
  var PST_C = [
    [-4, -2, 0, 0, 0, 0, 0, -2, -4],
    [-2, 0, 2, 2, 2, 2, 2, 0, -2],
    [0, 2, 4, 4, 4, 4, 4, 2, 0],
    [0, 2, 4, 6, 6, 6, 4, 2, 0],
    [0, 2, 4, 6, 6, 6, 4, 2, 0],
    [0, 2, 4, 6, 6, 6, 4, 2, 0],
    [-2, 0, 2, 4, 4, 4, 2, 0, -2],
    [-4, -2, 0, 2, 2, 2, 0, -2, -4],
    [-4, -2, 0, 2, 2, 2, 0, -2, -4],
    [-6, -4, -2, 0, 0, 0, -2, -4, -6]
  ];
  var PST_P = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 60, 70, 60, 0, 0, 0],
    [10, 10, 10, 90, 110, 90, 10, 10, 10],
    [30, 30, 40, 110, 130, 110, 40, 30, 30],
    [40, 50, 60, 120, 140, 120, 60, 50, 40],
    [20, 20, 20, 60, 80, 60, 20, 20, 20],
    [0, 0, 0, 30, 40, 30, 0, 0, 0],
    [-10, -10, -10, 0, 10, 0, -10, -10, -10],
    [-20, -20, -20, -10, 0, -10, -20, -20, -20],
    [-30, -30, -30, -20, -20, -20, -30, -30, -30]
  ];
  // 帅/将、仕/士、相/象：细粒度位置加分（红方视角，默认 0）
  var PST_K = {}, PST_A = {}, PST_B = {};
  PST_K['9,4'] = 10; PST_K['9,3'] = 6; PST_K['9,5'] = 6;
  PST_K['8,4'] = -8; PST_K['8,3'] = -8; PST_K['8,5'] = -8;
  PST_K['7,4'] = -14; PST_K['7,3'] = -12; PST_K['7,5'] = -12;
  PST_A['7,3'] = 4; PST_A['7,5'] = 4; PST_A['8,4'] = -4;
  PST_A['9,3'] = 0; PST_A['9,5'] = 0;
  PST_B['5,4'] = 8; PST_B['7,2'] = 4; PST_B['7,6'] = 4;
  PST_B['7,0'] = 2; PST_B['7,8'] = 2; PST_B['5,2'] = 4; PST_B['5,6'] = 4;

  function pst(code, r, c) {
    if (code === R) return PST_R[r][c];
    if (code === N) return PST_N[r][c];
    if (code === C) return PST_C[r][c];
    if (code === P) return PST_P[r][c];
    var key = r + ',' + c;
    if (code === K) return PST_K[key] || 0;
    if (code === A) return PST_A[key] || 0;
    if (code === B) return PST_B[key] || 0;
    return 0;
  }

  function evaluate(s) {
    var b = s.board, score = 0;
    for (var sq = 0; sq < SQ; sq++) {
      var v = b[sq];
      if (v === 0) continue;
      var code = v < 0 ? -v : v;
      var r = (sq / 9) | 0, c = sq % 9;
      var val = VALUE[code] + pst(code, r, c);
      if (v > 0) score += val;              // 红
      else score -= pst(code, 9 - r, 8 - c) + VALUE[code];  // 黑镜像
    }
    return score;  // 红正黑负
  }

  /* ============================================================
   * 搜索：迭代加深 + Alpha-Beta + 静态搜索 + 历史表/杀手启发
   * ============================================================ */
  var hist = new Int32Array(SQ * SQ);
  var killers = [];
  var histDepth = [];

  function resetHeuristics() {
    hist.fill(0);
    killers = [];
    histDepth = [];
  }

  function tkey(f, t) { return f * SQ + t; }

  function orderScore(s, mv, ply, killer1, killer2) {
    if (mv.captured) {
      var victim = mv.captured < 0 ? -mv.captured : mv.captured;
      var att = mv.piece < 0 ? -mv.piece : mv.piece;
      return 1000000 + VALUE[victim] * 10 - VALUE[att];
    }
    if (killer1 && mv.f === killer1.f && mv.t === killer1.t) return 900000;
    if (killer2 && mv.f === killer2.f && mv.t === killer2.t) return 800000;
    return hist[tkey(mv.f, mv.t)];
  }

  function negamax(s, depth, alpha, beta, ply, deadline, nodes) {
    nodes.n++;
    if ((nodes.n & 1023) === 0 && Date.now() > deadline) throw 'timeout';

    var moves = legalMoves(s);
    if (moves.length === 0) return -(MATE - ply);

    if (depth === 0) return qsearch(s, alpha, beta, 0, ply, deadline, nodes);

    var k1 = killers[ply] ? killers[ply][0] : null;
    var k2 = killers[ply] ? killers[ply][1] : null;
    moves.sort(function (a, b) {
      return orderScore(s, b, ply, k1, k2) - orderScore(s, a, ply, k1, k2);
    });

    var best = -INF;
    for (var i = 0; i < moves.length; i++) {
      var mv = moves[i];
      make(s, mv, false);
      var sc;
      try { sc = -negamax(s, depth - 1, -beta, -alpha, ply + 1, deadline, nodes); }
      catch (e) { unmake(s, mv, false); throw e; }
      unmake(s, mv, false);

      if (sc > best) best = sc;
      if (sc > alpha) alpha = sc;
      if (alpha >= beta) {
        if (!mv.captured) {
          if (!killers[ply]) killers[ply] = [null, null];
          var kk = killers[ply];
          if (!(kk[0] && kk[0].f === mv.f && kk[0].t === mv.t)) {
            kk[1] = kk[0]; kk[0] = mv;
          }
          hist[tkey(mv.f, mv.t)] += depth * depth;
        }
        break;
      }
    }
    return best;
  }

  function qsearch(s, alpha, beta, qd, ply, deadline, nodes) {
    nodes.n++;
    if ((nodes.n & 2047) === 0 && Date.now() > deadline) throw 'timeout';
    if (qd >= 6) {
      var v0 = evaluate(s);
      return s.side === RED ? v0 : -v0;
    }

    // 终局优先：无棋可走即判负（将死/困毙），避免静态搜索漏判
    var moves = legalMoves(s);
    if (moves.length === 0) return -(MATE - ply);

    var stand = evaluate(s);
    stand = s.side === RED ? stand : -stand;
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;

    // 吃子优先，其次“将军延伸”（让对手必应的着法也进入静态搜索，
    // 使牵制、杀棋等战术在浅层也能被正确评估）
    var caps = [], chk = [];
    var otherSide = s.side === RED ? BLACK : RED;
    for (var i = 0; i < moves.length; i++) {
      var mv = moves[i];
      if (mv.captured) caps.push(mv);
      else {
        make(s, mv, false);
        if (isAttacked(s.board, otherSide, s.kg[otherSide])) chk.push(mv);
        unmake(s, mv, false);
      }
    }
    caps = caps.concat(chk);
    if (!caps.length) return alpha;

    caps.sort(function (a, b) {
      if (!a.captured && !b.captured) return 0;
      if (!a.captured) return 1;          // 非吃子（将军延伸）排后
      if (!b.captured) return -1;
      var va = a.captured < 0 ? -a.captured : a.captured, vb = b.captured < 0 ? -b.captured : b.captured;
      var aa = a.piece < 0 ? -a.piece : a.piece, ab = b.piece < 0 ? -b.piece : b.piece;
      return (VALUE[vb] * 10 - VALUE[ab]) - (VALUE[va] * 10 - VALUE[aa]);
    });

    for (var j = 0; j < caps.length; j++) {
      var mv = caps[j];
      make(s, mv, false);
      var sc;
      try { sc = -qsearch(s, -beta, -alpha, qd + 1, ply + 1, deadline, nodes); }
      catch (e) { unmake(s, mv, false); throw e; }
      unmake(s, mv, false);
      if (sc >= beta) return beta;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  }

  /* ---------------- 开局库 ---------------- */
  // 红方常见第一步 → 黑方应着（坐标 from:r,c → to:r,c，红方 row7 为炮线、row9 为底线）
  var BOOK_REPLY = {
    '7,1>7,4': [[0, 1, 2, 2]],   // 炮二平五 → 马8进7
    '7,7>7,4': [[0, 7, 2, 6]],   // 炮八平五 → 马2进3
    '9,1>7,2': [[3, 2, 4, 2]],   // 马二进三 → 卒7进1
    '9,7>7,6': [[3, 6, 4, 6]],   // 马八进七 → 卒3进1
    '6,0>5,0': [[3, 2, 4, 2]],   // 兵七进一 → 卒7进1
    '6,2>5,2': [[3, 2, 4, 2]],   // 兵三进一 → 卒7进1
    '6,4>5,4': [[2, 1, 2, 4]],   // 兵五进一 → 炮8平5
    '9,2>7,4': [[0, 1, 2, 2]],   // 相三进五 → 马8进7
    '9,6>7,4': [[0, 7, 2, 6]],   // 相七进五 → 马2进3
    '9,3>8,4': [[0, 1, 2, 2]],   // 仕四进五 → 马8进7
    '9,5>8,4': [[0, 7, 2, 6]],   // 仕六进五 → 马2进3
    '7,1>7,3': [[0, 1, 2, 2]],   // 炮二平四 → 马8进7
    '7,7>7,5': [[0, 7, 2, 6]]    // 炮八平六 → 马2进3
  };
  var BOOK_OPEN = [   // 执红时的AI先行
    [7, 1, 7, 4], [7, 7, 7, 4], [9, 1, 7, 2], [9, 7, 7, 6],
    [6, 0, 5, 0], [6, 2, 5, 2], [9, 2, 7, 4], [9, 6, 7, 4]
  ];

  function bookMove(s, aiSide) {
    if (s.side !== aiSide) return null;
    var legal = legalMoves(s);
    if (!legal.length) return null;
    var legalSet = {};
    for (var i = 0; i < legal.length; i++) legalSet[legal[i].f + '>' + legal[i].t] = legal[i];

    if (s.history.length === 0 && aiSide === RED) {
      var cands = [];
      for (var j = 0; j < BOOK_OPEN.length; j++) {
        var m = BOOK_OPEN[j];
        var idx = m[0] * 9 + m[1], t2 = m[2] * 9 + m[3];
        if (legalSet[idx + '>' + t2]) cands.push(m);
      }
      if (cands.length) return { f: cands[0][0] * 9 + cands[0][1], t: cands[0][2] * 9 + cands[0][3], captured: 0, piece: s.board[cands[0][0] * 9 + cands[0][1]] };
    }
    if (s.history.length === 1 && aiSide === BLACK) {
      var first = s.history[0];
      var key = ((first.f / 9) | 0) + ',' + (first.f % 9) + '>' + ((first.t / 9) | 0) + ',' + (first.t % 9);
      var replies = BOOK_REPLY[key];
      if (replies) {
        for (var k = 0; k < replies.length; k++) {
          var rm = replies[k];
          var ridx = rm[0] * 9 + rm[1], rt = rm[2] * 9 + rm[3];
          if (legalSet[ridx + '>' + rt])
            return { f: ridx, t: rt, captured: 0, piece: s.board[ridx] };
        }
      }
    }
    return null;
  }

  /* ---------------- 六档难度 ---------------- */
  var LEVELS = [
    { name: '入门', maxDepth: 1, time: 0.10, margin: 0, qsearch: false, random: true },
    { name: '简单', maxDepth: 2, time: 0.30, margin: 60, qsearch: false, random: false },
    { name: '普通', maxDepth: 3, time: 0.70, margin: 30, qsearch: false, random: false },
    { name: '困难', maxDepth: 4, time: 1.60, margin: 12, qsearch: false, random: false },
    { name: '大师', maxDepth: 5, time: 3.50, margin: 4, qsearch: true, random: false },
    { name: '宗师', maxDepth: 6, time: 5.00, margin: 0, qsearch: true, random: false }
  ];

  /* ---------------- AI 决策入口 ---------------- */
  function searchBest(s, cfg, deadline) {
    var moves = legalMoves(s);
    if (!moves.length) return null;

    // 开局库
    var bk = bookMove(s, s.side);
    if (bk) return bk;

    // 第一档：纯随机（不做吃子偏好，保证明显弱于第二档）
    if (cfg.random) {
      return moves[(Math.random() * moves.length) | 0];
    }

    var dl = deadline || Date.now() + cfg.time * 1000;
    resetHeuristics();
    var nodes = { n: 0 };

    // 按上一轮得分排序根走法
    var lastRoot = [];
    for (var i = 0; i < moves.length; i++) lastRoot.push({ mv: moves[i], sc: 0 });

    var bestMove = lastRoot[0].mv;
    var bestScore = -INF;

    function runRootDepth(depth, alpha, beta, lastRootArr) {
      // 返回 {score, best}；超时抛 'timeout'
      lastRootArr.sort(function (a, b) { return b.sc - a.sc; });
      var iterBest = null, iterScore = -INF;
      for (var j = 0; j < lastRootArr.length; j++) {
        var mv = lastRootArr[j].mv;
        make(s, mv, false);
        var sc;
        try {
          sc = -negamax(s, depth - 1, -beta, -alpha, 1, dl, nodes);
        } catch (e) {
          unmake(s, mv, false);
          throw e;
        }
        unmake(s, mv, false);
        lastRootArr[j].sc = sc;
        if (sc > iterScore) { iterScore = sc; iterBest = mv; }
        if (sc > alpha) alpha = sc;
      }
      return { score: iterScore, best: iterBest };
    }

    var prevScore = 0;
    for (var depth = 1; depth <= cfg.maxDepth; depth++) {
      // 期望窗口：围绕上一完整层得分 ±60cp，命中则大幅剪枝；越界则全窗重搜
      var alpha = -INF, beta = INF;
      if (depth >= 3 && prevScore > -MATE / 2 && prevScore < MATE / 2) {
        alpha = prevScore - 60;
        beta = prevScore + 60;
      }
      var r;
      try {
        r = runRootDepth(depth, alpha, beta, lastRoot);
      } catch (e) {
        break;   // 超时：保留上一完整层的成果
      }
      if (r.score <= alpha || r.score >= beta) {   // 期望窗口越界
        try {
          r = runRootDepth(depth, -INF, INF, lastRoot);
        } catch (e) {
          break;
        }
      }
      if (r.best) {
        bestMove = r.best;
        bestScore = r.score;
        prevScore = r.score;
        searchBest.lastDepth = depth;   // 本层完整搜完（调试用）
      }
      if (Date.now() > dl) break;
    }

    if (cfg.margin > 0) {
      var pool = [];
      for (var k = 0; k < lastRoot.length; k++) {
        if (lastRoot[k].sc >= bestScore - cfg.margin) pool.push(lastRoot[k].mv);
      }
      if (pool.length) return pool[(Math.random() * pool.length) | 0];
    }
    return bestMove;
  }

  /* ---------------- 导出 ---------------- */
  var Xiangqi = {
    K: K, A: A, B: B, N: N, R: R, C: C, P: P,
    RED: RED, BLACK: BLACK, ROWS: ROWS, COLS: COLS,
    PIECE_NAME: PIECE_NAME, PIECE_NAME_B: PIECE_NAME_B,
    VALUE: VALUE, LEVELS: LEVELS,
    createGame: createGame,
    genAll: genAll,
    legalMoves: legalMoves,
    isAttacked: isAttacked,
    isInCheck: isInCheck,
    make: make,
    unmake: unmake,
    gameStatus: gameStatus,
    keyOf: keyOf,
    evaluate: evaluate,
    searchBest: searchBest,
    bookMove: bookMove
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Xiangqi;
  else global.Xiangqi = Xiangqi;
})(typeof window !== 'undefined' ? window : globalThis);