// Builds the installable (PWA) version of JournalBird into ./app from journalbird.html.
// journalbird.html is the single source; this wraps it with a manifest, icons and an offline service worker.
//   node build.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

const OUT = new URL("./app/", import.meta.url);
mkdirSync(OUT, { recursive: true });
const write = (name, data) => writeFileSync(new URL(name, OUT), data);

const page = readFileSync(new URL("./journalbird.html", import.meta.url), "utf8");
const version = Date.now().toString(36);

// ---------- icons: the bluebird on a dawn sky, drawn pixel by pixel ----------
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const clamp01 = t => Math.max(0, Math.min(1, t));
const mix = (a, b, t) => a + (b - a) * clamp01(t);
const mixC = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const ell = (u, v, cx, cy, rx, ry, a = 0) => {
  const dx = u - cx, dy = v - cy, c = Math.cos(a), s = Math.sin(a);
  const x = dx * c + dy * s, y = -dx * s + dy * c;
  return (x / rx) ** 2 + (y / ry) ** 2 <= 1;
};
const tri = (u, v, [ax, ay], [bx, by], [cx, cy]) => {
  const d = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
  const l1 = ((u - ax) * (cy - ay) - (cx - ax) * (v - ay)) / d;
  const l2 = ((bx - ax) * (v - ay) - (u - ax) * (by - ay)) / d;
  return l1 >= 0 && l2 >= 0 && l1 + l2 <= 1;
};

const SKY = [[0, hex("#3c4a96")], [0.55, hex("#b0689f")], [1, hex("#ffb27a")]];
function sky(u, v) {
  let c = SKY[SKY.length - 1][1];
  for (let i = 0; i < SKY.length - 1; i++) {
    if (v <= SKY[i + 1][0]) { c = mixC(SKY[i][1], SKY[i + 1][1], (v - SKY[i][0]) / (SKY[i + 1][0] - SKY[i][0])); break; }
  }
  const glow = Math.exp(-(((u - 0.5) / 0.5) ** 2 + ((v - 1.0) / 0.35) ** 2));
  return mixC(c, hex("#ffe2b0"), glow * 0.7);
}

const BLUE = hex("#4f8be0"), WING = hex("#2c58a8"), BREAST = hex("#f3a46c"), DARK = hex("#2a2433"), BRANCH = hex("#5b3f30"), WHITE = [255, 255, 255];
function art(u, v) {
  if (ell(u, v, 0.5, 0.79, 0.42, 0.028, 0.02)) return BRANCH;
  if (ell(u, v, 0.77, 0.68, 0.15, 0.05, 0.5)) return WING;
  const body = ell(u, v, 0.53, 0.58, 0.27, 0.21, 0.12);
  if (body && ell(u, v, 0.44, 0.64, 0.17, 0.12, -0.25)) return BREAST;
  if (ell(u, v, 0.6, 0.55, 0.17, 0.1, 0.5)) return WING;
  if (body) return BLUE;
  if (tri(u, v, [0.22, 0.4], [0.1, 0.46], [0.23, 0.5])) return DARK;
  if (ell(u, v, 0.3, 0.385, 0.011, 0.011)) return WHITE;
  if (ell(u, v, 0.31, 0.395, 0.024, 0.024)) return DARK;
  if (ell(u, v, 0.37, 0.43, 0.165, 0.165)) return BLUE;
  return null;
}

function iconPNG(size, { maskable = false } = {}) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const S = maskable ? 0.74 : 1; // shrink the bird into the maskable safe zone
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
        const u = (x + (sx + 0.5) / 2) / size, v = (y + (sy + 0.5) / 2) / size;
        const c = art((u - 0.5) / S + 0.5, (v - 0.5) / S + 0.5) || sky(u, v);
        r += c[0]; g += c[1]; b += c[2];
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r / 4; raw[o + 1] = g / 4; raw[o + 2] = b / 4; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
write("icon-192.png", iconPNG(192));
write("icon-512.png", iconPNG(512));
write("icon-maskable-512.png", iconPNG(512, { maskable: true }));
write("apple-touch-icon.png", iconPNG(180));

// ---------- manifest ----------
write("manifest.webmanifest", JSON.stringify({
  name: "JournalBird",
  short_name: "JournalBird",
  description: "A morning, a day and a night, each with its own bird.",
  start_url: "./",
  scope: "./",
  display: "standalone",
  orientation: "portrait",
  background_color: "#17123a",
  theme_color: "#17123a",
  icons: [
    { src: "icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
}, null, 2));

// ---------- service worker: app shell offline, fonts cached on first use ----------
write("sw.js", `const CACHE = "journalbird-${version}";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (url.origin !== location.origin && !isFont) return;
  if (req.mode === "navigate") {
    // network first for the page so updates land, cache when offline
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put("./index.html", copy)); return r; }).catch(() => caches.match("./index.html")));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok || r.type === "opaque") { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return r;
  })));
});
`);

// ---------- index.html ----------
write("index.html", `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#17123a">
<meta name="description" content="A morning, a day and a night, each with its own bird.">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="JournalBird">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" href="icon-192.png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);box-sizing:border-box}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${page}
<script>
if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
</script>
</body>
</html>
`);

console.log("Built app/ (version " + version + ")");
