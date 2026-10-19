// iOS runs an installed web app in a letterboxed compatibility mode (window shorter than the screen)
// unless an apple-touch-startup-image matches the device. Generates one per common iPhone size and
// prints the <link> tags for index.html.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

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

// Same art as make-icons.mjs, centred on a flat night-blue background.
function png(w, h) {
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  const icon = Math.round(w * 0.32);
  const x0 = Math.round((w - icon) / 2);
  const y0 = Math.round((h - icon) / 2);
  for (let y = 0; y < h; y++) {
    const o0 = y * stride;
    for (let x = 0; x < w; x++) {
      let [r, g, b] = [15, 27, 45];
      const ix = x - x0;
      const iy = y - y0;
      if (ix >= 0 && iy >= 0 && ix < icon && iy < icon) {
        const u = ix / icon;
        const v = iy / icon;
        r = 15 + v * 20; g = 27 + v * 30; b = 45 + v * 40;
        if (Math.hypot(u - 0.7, v - 0.3) < 0.11) [r, g, b] = [255, 181, 71];
        const ridge = Math.max(1 - Math.abs(u - 0.42) * 1.6, 0.8 - Math.abs(u - 0.78) * 1.8);
        const surface = 1 - ridge * 0.62 - 0.08;
        if (v > surface) {
          const snow = v < surface + 0.14 && ridge > 0.62;
          [r, g, b] = snow ? [238, 243, 250] : [47, 72, 110];
        }
      }
      const o = o0 + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// [CSS width, CSS height, pixel ratio]
const DEVICES = [
  [440, 956, 3], [420, 912, 3], [402, 874, 3], [430, 932, 3], [428, 926, 3], [393, 852, 3],
  [390, 844, 3], [375, 812, 3], [414, 896, 3], [414, 896, 2], [375, 667, 2],
];
mkdirSync('public/splash', { recursive: true });
const links = [];
for (const [w, h, r] of DEVICES) {
  const name = `splash-${w * r}x${h * r}.png`;
  writeFileSync(`public/splash/${name}`, png(w * r, h * r));
  links.push(
    `    <link rel="apple-touch-startup-image" href="splash/${name}" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)" />`,
  );
}
console.log(links.join('\n'));
