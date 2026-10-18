// Rasterises the app icon (night sky, mountain, sun) into PNGs without external deps.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

function crc32(buf) {
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    let c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      let r = 15 + v * 20;
      let g = 27 + v * 30;
      let b = 45 + v * 40;
      if (Math.hypot(u - 0.7, v - 0.3) < 0.11) [r, g, b] = [255, 181, 71];
      const ridge = Math.max(1 - Math.abs(u - 0.42) * 1.6, 0.8 - Math.abs(u - 0.78) * 1.8);
      const surface = 1 - ridge * 0.62 - 0.08;
      if (v > surface) {
        const snow = v < surface + 0.14 && ridge > 0.62;
        [r, g, b] = snow ? [238, 243, 250] : [47, 72, 110];
      }
      const o = y * stride + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync('public/icons/icon-192.png', png(192));
writeFileSync('public/icons/icon-512.png', png(512));
writeFileSync('public/icons/apple-touch-icon.png', png(180));
