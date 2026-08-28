/* 生成 PWA 图标（无第三方依赖，纯 Node）
 * node make-icons.js  →  icons/icon-192.png  icons/icon-512.png
 * 绘制：深绿圆角底 + 木质圆盘 + 红色“車”字形
 */
'use strict';
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

/* ---------- PNG 编码 ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8bit RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/* ---------- 绘制 ---------- */
function makeIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const S = size;
  const px = (x, y, r, g, b, a = 255) => {
    if (x < 0 || x >= S || y < 0 || y >= S) return;
    const i = (y * S + x) * 4;
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
  };
  const blend = (x, y, r, g, b, a) => {
    const i = (y * S + x) * 4;
    const da = a / 255;
    const ba = buf[i + 3] / 255;
    const oa = da + ba * (1 - da);
    if (oa === 0) return;
    buf[i] = Math.round((r * da + buf[i] * ba * (1 - da)) / oa);
    buf[i + 1] = Math.round((g * da + buf[i + 1] * ba * (1 - da)) / oa);
    buf[i + 2] = Math.round((b * da + buf[i + 2] * ba * (1 - da)) / oa);
    buf[i + 3] = Math.round(oa * 255);
  };
  const fillRect = (x0, y0, w, h, r, g, b, a = 255) => {
    for (let y = Math.max(0, y0 | 0); y < Math.min(S, (y0 + h) | 0); y++)
      for (let x = Math.max(0, x0 | 0); x < Math.min(S, (x0 + w) | 0); x++)
        px(x, y, r, g, b, a);
  };
  const fillCircle = (cx, cy, rad, r, g, b, a = 255) => {
    for (let y = Math.max(0, (cy - rad) | 0); y < Math.min(S, (cy + rad) | 0); y++)
      for (let x = Math.max(0, (cx - rad) | 0); x < Math.min(S, (cx + rad) | 0); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= rad) px(x, y, r, g, b, a);
      }
  };
  const ring = (cx, cy, rad, thick, r, g, b, a = 255) => {
    for (let y = Math.max(0, (cy - rad) | 0); y < Math.min(S, (cy + rad) | 0); y++)
      for (let x = Math.max(0, (cx - rad) | 0); x < Math.min(S, (cx + rad) | 0); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= rad && d >= rad - thick) px(x, y, r, g, b, a);
      }
  };
  const inRoundRect = (x, y, x0, y0, w, h, rad) => {
    if (x < x0 || x > x0 + w || y < y0 || y > y0 + h) return false;
    const cx = Math.min(Math.max(x, x0 + rad), x0 + w - rad);
    const cy = Math.min(Math.max(y, y0 + rad), y0 + h - rad);
    return Math.hypot(x - cx, y - cy) <= rad;
  };

  const u = S / 512; // 以 512 为基准
  // 底色：深绿圆角方块
  const bgGrad = [[29, 40, 35], [26, 36, 32], [20, 29, 26]];
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if (inRoundRect(x + 0.5, y + 0.5, 0, 0, S, S, 96 * u)) {
        const t = y / S;
        const c = t < 0.5 ? bgGrad[0] : bgGrad[1];
        blend(x, y, c[0], c[1], c[2], 255);
      }
    }
  // 内框描边：只画在外圆角框与内圆角框之间的 8u 环带
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const inOuter = inRoundRect(x + 0.5, y + 0.5, 3 * u, 3 * u, S - 6 * u, S - 6 * u, 93 * u)
        && !inRoundRect(x + 0.5, y + 0.5, 0, 0, S, S, 96 * u - 3 * u);
      const inInner = inRoundRect(x + 0.5, y + 0.5, 12 * u, 12 * u, S - 24 * u, S - 24 * u, 84 * u);
      if (inOuter && !inInner) blend(x, y, 224, 186, 120, 110);
    }

  // 木质圆盘（微偏移給投影感）
  const discCx = 256 * u, discCy = 268 * u, discR = 176 * u;
  fillCircle(discCx, discCy, discR, 238, 220, 186);
  ring(discCx, discCy + 4 * u, discR * 0.98, 10 * u, 142, 52, 39, 255);    // 红边
  ring(discCx, discCy, discR * 0.9, 6 * u, 200, 150, 90, 120);            // 内圈
  ring(discCx, discCy, 10 * u, 5 * u, 190, 140, 80, 90);                  // 中心点
  // 高光
  fillCircle(discCx - discR * 0.38, discCy - discR * 0.42, discR * 0.5, 255, 248, 232, 26);

  // “車”字形（红色）
  const rx = 176 * u, ry = 186 * u, rw = 160 * u, rh = 168 * u;
  const col = [179, 38, 30];
  const C = (x0, y0, w, h) => fillRect(x0, y0, w, h, col[0], col[1], col[2]);
  C(rx, ry, rw, 24 * u);                    // 顶横
  C(rx + 10 * u, ry + 40 * u, rw - 20 * u, 22 * u);   // 二横
  C(rx, ry + 20 * u, 26 * u, 96 * u);       // 左竖
  C(rx + rw - 26 * u, ry + 20 * u, 26 * u, 96 * u);   // 右竖
  C(rx + rw / 2 - 12 * u, ry + 20 * u, 24 * u, 96 * u);  // 中竖
  C(rx, ry + 116 * u, rw, 26 * u);          // 底横
  C(rx, ry + 152 * u, 46 * u, 26 * u);      // 左轮
  C(rx + rw - 46 * u, ry + 152 * u, 46 * u, 26 * u);   // 右轮

  return encodePNG(S, S, buf);
}

const out = path.join(__dirname, 'icons');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon-192.png'), makeIcon(192));
fs.writeFileSync(path.join(out, 'icon-512.png'), makeIcon(512));
console.log('icons generated:', path.join(out, 'icon-192.png'), path.join(out, 'icon-512.png'));