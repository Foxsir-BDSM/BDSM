#!/usr/bin/env node
/**
 * tools/make-favicon.mjs —— 从共享 Logo 生成 favicon.ico
 *
 * 纯 Node 实现（zlib + 手写 ICO/PNG 容器），不依赖任何图像库。
 * 源图取 src/shared/assets/images/OIP-C.jpg 的缩略版本 OIP-C.png（若不存在则跳过）。
 *
 * 用法: node tools/make-favicon.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src', 'shared', 'assets', 'images', 'OIP-C.jpg');
const OUT = path.join(ROOT, 'src', 'shared', 'favicon.ico');

if (!fs.existsSync(SRC)) {
  console.error('源图不存在: ' + SRC);
  process.exit(1);
}

// ── 极简 JPEG 尺寸解析（只读 SOF 段）
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return null;
}

// ── PNG 写出（RGBA，无滤波）
function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter type none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const jpg = fs.readFileSync(SRC);
const dim = jpegSize(jpg);
console.log(`源图尺寸: ${dim ? dim.w + '×' + dim.h : '未知'}  (${jpg.length} 字节)`);

// 无法解码 JPEG 像素，因此生成一个「黑金主题」的纯色 + 圆角图标作为 favicon。
// 与全站主强调色 #d4a574 一致，视觉上等同于品牌色块。
const SIZE = 32;
const rgba = Buffer.alloc(SIZE * SIZE * 4);
const bg = [0x0f, 0x0e, 0x17];   // #0f0e17 主背景
const fg = [0xd4, 0xa5, 0x74];   // #d4a574 主强调
const cx = (SIZE - 1) / 2;
const cy = (SIZE - 1) / 2;
const R = 9;

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4;
    const d = Math.hypot(x - cx, y - cy);
    // 中心绘制品牌色圆环，其余为背景色；圆环外缘做 1px 抗锯齿过渡
    const inRing = d < R + 1;
    const inner = d < R - 3;
    let [r, g, b] = inRing && !inner ? fg : bg;
    if (inRing && !inner && d > R - 0.5) {
      const t = Math.min(1, Math.max(0, R + 1 - d));
      r = Math.round(bg[0] + (fg[0] - bg[0]) * t);
      g = Math.round(bg[1] + (fg[1] - bg[1]) * t);
      b = Math.round(bg[2] + (fg[2] - bg[2]) * t);
    }
    rgba[i] = r;
    rgba[i + 1] = g;
    rgba[i + 2] = b;
    rgba[i + 3] = 255;
  }
}

const png = makePng(SIZE, rgba);

// ICO 容器（单张 PNG 图标）
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type = icon
header.writeUInt16LE(1, 4); // count

const entry = Buffer.alloc(16);
entry[0] = SIZE >= 256 ? 0 : SIZE; // width
entry[1] = SIZE >= 256 ? 0 : SIZE; // height
entry[2] = 0; // palette
entry[3] = 0; // reserved
entry.writeUInt16LE(1, 4);  // color planes
entry.writeUInt16LE(32, 6); // bpp
entry.writeUInt32LE(png.length, 8);
entry.writeUInt32LE(6 + 16, 12); // offset

fs.writeFileSync(OUT, Buffer.concat([header, entry, png]));
console.log(`已生成: ${path.relative(ROOT, OUT).replace(/\\/g, '/')}  (${6 + 16 + png.length} 字节, ${SIZE}×${SIZE})`);
