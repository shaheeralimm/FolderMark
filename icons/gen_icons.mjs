/**
 * Generates icon16.png, icon48.png, icon128.png from scratch.
 * Uses only Node built-ins + zlib. No npm install required.
 * Run once: node icons/gen_icons.mjs
 */
import { createWriteStream } from "fs";
import { deflateSync } from "zlib";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Indigo #4F46E5 background, white bookmark ribbon
const BG = [0x4f, 0x46, 0xe5, 0xff];   // indigo
const FG = [0xff, 0xff, 0xff, 0xff];   // white
const TR = [0x00, 0x00, 0x00, 0x00];   // transparent

function circleFill(cx, cy, r, x, y) {
  return (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2;
}

// Bookmark ribbon: rect with a V-notch cut from the bottom centre
function bookmarkFill(size, x, y) {
  const pad  = size * 0.22;
  const left = pad;
  const right = size - pad;
  const top  = size * 0.18;
  const bot  = size * 0.82;
  const notchDepth = size * 0.14;  // how deep the V goes up

  if (x < left || x > right) return false;
  if (y < top)  return false;
  if (y > bot)  return false;

  // V-notch at bottom: cut a triangle from the bottom edge upward
  const mid = size / 2;
  const notchTop = bot - notchDepth;
  if (y > notchTop) {
    // inside notch zone — cut proportionally to distance from mid
    const dist = Math.abs(x - mid);
    const halfWidth = (right - left) / 2;
    // notch sides slope from (left,bot) and (right,bot) to (mid, notchTop)
    const threshold = ((y - notchTop) / notchDepth) * halfWidth;
    if (dist < halfWidth - threshold) return false;
  }

  return true;
}

function makePixel(size, x, y) {
  const cx = size / 2;
  const cy = size / 2;
  const r  = size / 2 - 1;

  if (!circleFill(cx, cy, r, x + 0.5, y + 0.5)) return TR;
  if (bookmarkFill(size, x + 0.5, y + 0.5))       return FG;
  return BG;
}

function renderImage(size) {
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = new Uint8Array(1 + size * 4); // filter byte + RGBA
    row[0] = 0; // None filter
    for (let x = 0; x < size; x++) {
      const px = makePixel(size, x, y);
      row[1 + x * 4 + 0] = px[0];
      row[1 + x * 4 + 1] = px[1];
      row[1 + x * 4 + 2] = px[2];
      row[1 + x * 4 + 3] = px[3];
    }
    rows.push(row);
  }
  return rows;
}

function crc32(buf) {
  const table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })();
  let c = 0xffffffff;
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u32be(n) {
  return Buffer.from([n >>> 24, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
}

function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const crc = crc32(Buffer.concat([t, d]));
  return Buffer.concat([u32be(d.length), t, d, u32be(crc)]);
}

function encodePNG(size) {
  const rows = renderImage(size);
  const raw  = Buffer.concat(rows.map(r => Buffer.from(r)));
  const compressed = deflateSync(raw, { level: 9 });

  const ihdr = Buffer.concat([
    u32be(size), u32be(size),
    Buffer.from([8, 6, 0, 0, 0]), // 8-bit RGBA
  ]);

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [16, 48, 128]) {
  const png  = encodePNG(size);
  const path = join(__dirname, `icon${size}.png`);
  const ws   = createWriteStream(path);
  ws.write(png);
  ws.end();
  console.log(`wrote ${path} (${png.length} bytes)`);
}
