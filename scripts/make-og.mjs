// Draws public/og.png (1200×630), the share card, with no browser or image library: shapes into an RGBA
// buffer, a 5×7 bitmap font for the title, and a minimal PNG encoder on node:zlib.
// Run: node scripts/make-og.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const W = 1200, H = 630;
const px = new Uint8Array(W * H * 4);
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function blend(x, y, [r, g, b], a = 1) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  px[i] = px[i] * (1 - a) + r * a;
  px[i + 1] = px[i + 1] * (1 - a) + g * a;
  px[i + 2] = px[i + 2] * (1 - a) + b * a;
  px[i + 3] = 255;
}
function rect(x0, y0, w, h, c, a = 1) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) blend(x, y, c, a);
}
function circle(cx, cy, r, c, ring = 0) {
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
    for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const outer = Math.min(1, Math.max(0, r - d + 0.5));
      const inner = ring ? Math.min(1, Math.max(0, d - (r - ring) + 0.5)) : 1;
      const a = outer * inner;
      if (a > 0) blend(x, y, c, a);
    }
}

const FONT = {
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};
function text(str, x, y, cell, c) {
  for (const ch of str) {
    const g = FONT[ch];
    g.forEach((row, ry) => [...row].forEach((on, rx) => on === "1" && rect(x + rx * cell, y + ry * cell, cell - 2, cell - 2, c)));
    x += cell * 6;
  }
}

// Background and the lanes on the right.
rect(0, 0, W, H, hex("#0f1020"));
const lanes = ["#5cc8ff", "#6ee7b7", "#ffd166", "#b49cff"].map(hex);
const lx = 700, lw = 110, hitY = 520;
lanes.forEach((c, i) => {
  rect(lx + i * lw, 0, lw, H, [255, 255, 255], i % 2 ? 0.05 : 0.025);
  circle(lx + i * lw + lw / 2, hitY, 34, c, 4);
});
rect(lx, hitY - 2, lw * 4, 4, [255, 255, 255], 0.5);
const notes = [[0, 120], [2, 230], [1, 330], [3, 420], [2, 40], [0, 505]];
for (const [lane, y] of notes) circle(lx + lane * lw + lw / 2, y, 29, lanes[lane]);

// The wheel mark and the title on the left.
const pink = hex("#ff7ab6");
circle(150, 190, 70, pink, 12);
circle(150, 190, 12, pink);
for (let k = 0; k < 8; k++) {
  const ang = (k * Math.PI) / 4;
  for (let t = 14; t < 60; t++) circle(150 + Math.cos(ang) * t, 190 + Math.sin(ang) * t, 2, pink);
}
circle(150, 120, 14, hex("#ffd166"));
text("SQUEEK", 80, 320, 16, hex("#f3f4ff"));
text("DJ", 80, 448, 16, pink);

// PNG encoding.
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0;
  Buffer.from(px.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1);
}
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);
writeFileSync(new URL("../public/og.png", import.meta.url), png);
console.log(`public/og.png ${png.length} bytes`);
