// 画像素材（src/art/。元のパックから scripts/build-art.py で作る）の読み込みと描画
import atlas from './art/atlas.json';
import workshopUrl from './art/workshop.webp';
import darumaUrl from './art/daruma.webp';
import iconsUrl from './art/icons.webp';
import artisansUrl from './art/artisans.webp';
import artmaskUrl from './art/artmask.webp';
import peopleUrl from './art/people.webp';
import bannersUrl from './art/banners.webp';
import benchUrl from './art/bench.webp';
export { default as signUrl } from './art/sign.webp';

const load = url => { const im = new Image(); im.src = url; return im; };
export const IMG = { workshop: load(workshopUrl), daruma: load(darumaUrl), icons: load(iconsUrl), bench: load(benchUrl),
  artisans: load(artisansUrl), artmask: load(artmaskUrl), people: load(peopleUrl), banners: load(bannersUrl) };

// 全部の画像が読めたら解決する（失敗しても止めない）
export const artReady = Promise.all(Object.values(IMG).map(im => im.decode().catch(() => {})));
const ok = im => im.complete && im.naturalWidth > 0;

export const RECTS = atlas;
// 絵 id を、下中央（cx, by）を基準に高さ h で描く。flip で左右反転
export function drawPart(g, sheet, id, cx, by, h, flip = false) {
  const im = IMG[sheet], r = atlas[sheet][id];
  if (!r || !ok(im)) return 0;
  const w = h * r[2] / r[3];
  if (flip) { g.save(); g.translate(cx, 0); g.scale(-1, 1); g.drawImage(im, ...r, -w / 2, by - h, w, h); g.restore(); }
  else g.drawImage(im, ...r, cx - w / 2, by - h, w, h);
  return w;
}
// 人物：足元の基準点（atlas の 5・6 番目）を (x, y) に合わせ、k 倍（論理 px / 絵の px）で描く
export function drawFig(g, sheet, id, x, y, k, flip = false) {
  const im = IMG[sheet], r = atlas[sheet][id];
  if (!r || !ok(im)) return;
  const [, , w, h, px, py] = r;
  g.save(); g.translate(x, y); if (flip) g.scale(-1, 1);
  g.drawImage(im, r[0], r[1], w, h, -px * k, -py * k, w * k, h * k);
  g.restore();
}
// 職人が持つ白だるまを色 c で塗った絵（マスクの濃淡に色をかける）。コマと色ごとに作って取っておく
const tintCache = new Map();
export function tinted(id, c) {
  const key = id + c;
  if (tintCache.has(key)) return tintCache.get(key);
  const r = atlas.artmask[id], m = IMG.artmask;
  if (!r || !ok(m)) return null;
  const cv = document.createElement('canvas');
  cv.width = r[2]; cv.height = r[3];
  const g = cv.getContext('2d');
  g.drawImage(m, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]);
  g.globalCompositeOperation = 'multiply'; g.fillStyle = c; g.fillRect(0, 0, r[2], r[3]);
  g.globalCompositeOperation = 'destination-in'; g.drawImage(m, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]);
  tintCache.set(key, cv);
  return cv;
}
export function drawTinted(g, id, c, x, y, k, flip = false) {
  const cv = tinted(id, c), r = atlas.artmask[id];
  if (!cv) return;
  g.save(); g.translate(x, y); if (flip) g.scale(-1, 1);
  g.drawImage(cv, -r[4] * k, -r[5] * k, r[2] * k, r[3] * k);
  g.restore();
}
// HTML の canvas に絵を収める（だるま・アイコン）
export function paintPart(c, sheet, id) {
  const r = atlas[sheet][id];
  if (!r) return false;
  const paint = () => {
    const g = c.getContext('2d'), k = Math.min(c.width / r[2], c.height / r[3]), w = r[2] * k, h = r[3] * k;
    g.clearRect(0, 0, c.width, c.height);
    g.imageSmoothingQuality = 'high';
    g.drawImage(IMG[sheet], ...r, (c.width - w) / 2, (c.height - h) / 2, w, h);
  };
  if (ok(IMG[sheet])) paint(); else IMG[sheet].decode().then(paint, () => {});
  return true;
}
