// 工房シーンの canvas 描画（基準 256x176 の論理座標、下揃え）
import { INK, COLORS, CK, TOTAL, DRAW_UNIT } from './constants.js';
import { IMG, RECTS, drawPart, drawFig, drawTinted } from './art.js';
import { rint, cnt } from './util.js';
import { rackCap, rackUsed, finN, phase, prodReason, inRush, activeEvents, activeAd } from './sim.js';
import { EVENT_TYPES } from './events.js';

// 絵のだるま1体＝DRAW_UNIT 個として描く（乾燥棚だけは容量に合わせて1体あたりを増やす）

const BW = 256, BH = 176, FLOOR = 118;
const MAX_VISITORS = 24, WALK = 110, WAIT = 0.6; // 画面に出す客の上限、歩く速さ(px/秒)、店先で止まる秒数

let cv, ctx, stage;
let W = BW, H = BH, SC = 3, ox = 0, oy = 0;
let S = null; // 描画中の状態（drawScene で差し替え）
const visitors = [];

export function initScene(canvas, stageEl) {
  cv = canvas; ctx = cv.getContext('2d'); stage = stageEl;
  new ResizeObserver(resize).observe(stage);
  resize();
}
function resize() {
  const r = stage.getBoundingClientRect();
  if (!r.width || !r.height) return;
  if (r.width / r.height > BW / BH) { H = BH; W = Math.round(BH * r.width / r.height); }
  else { W = BW; H = Math.round(BW * r.height / r.width); }
  ox = Math.floor((W - BW) / 2); oy = H - BH;
  const dpr = window.devicePixelRatio || 1;
  SC = Math.max(2, Math.min(6, 2 * Math.round(r.width * dpr / W / 2))); // 偶数（0.5 刻みの細かい点を描くため）
  cv.width = W * SC; cv.height = H * SC;
}

/* ---------- 客 ---------- */
// 後ろ姿の絵（src/art/people）。国籍・種類ごとに選ぶ。歩く4コマのある人（*-w0〜3）と、1枚絵の特別なお客
//   業者＝スーツに台車、小売店＝はっぴ、中国の団体＝旗を持ったツアーガイドと黒髪の人たち、欧米客＝リュック
const LOOKS = {
  jp: ['elder', 'bob', 'short', 'ponytail'],
  cn: ['short', 'ponytail', 'short', 'guide'],
  west: ['orange', 'orange', 'bob'],
  shop: ['happi'],
  trader: ['buyer'],
};
const pick = a => a[rint(0, a.length - 1)];
// 客1人。type＝person/shop/trader、want＝欲しい個数、sold＝買えた個数、origin＝jp/cn/west
export function addVisitor(k, type, want, sold, origin = 'jp', refused = false) {
  if (visitors.length >= MAX_VISITORS) return;
  const look = pick(LOOKS[type === 'person' ? origin : type] ?? LOOKS.jp);
  visitors.push({ x: W - ox + 2 + rint(0, 20), y: rint(0, 4), tx: rint(100, 224), k, type, want, sold, origin, refused, st: 'in', wait: 0, look,
    flip: rint(0, 1) === 1, ph: rint(0, 3) });
}
export function clearVisitors() { visitors.length = 0; }
export function moveVisitors(sec) {
  const v0 = WALK * sec;
  for (const v of visitors) {
    if (v.st === 'in') { v.x -= v0; if (v.x <= v.tx) { v.x = v.tx; v.st = 'wait'; v.wait = 0; } }
    else if (v.st === 'wait') { v.wait += sec; if (v.wait > WAIT) v.st = 'out'; }
    else v.x += v0;
  }
  // 画面の右端（論理座標で W - ox）から出ていった客を消す。入ってくる途中の客は消さない
  for (let i = visitors.length - 1; i >= 0; i--) if (visitors[i].st === 'out' && visitors[i].x > W - ox + 24) visitors.splice(i, 1);
}

/* ---------- 描画プリミティブ ---------- */
// 座標は論理ピクセル。SC は偶数なので 0.5 刻みまできれいに描ける（だるま・人は半分の細かさで描く）
function R(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
function T(s, x, y, size, c, align) { ctx.font = `${size}px "DotGothic16",sans-serif`; ctx.fillStyle = c; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); }
const dar = (k, x, y, s = 12) => drawPart(ctx, 'daruma', k, x + s / 2, y + s, s); // 左上 (x, y) から s×s に収める
/* ---------- 各パーツ ---------- */
// 背景は 1536×1280 の縦長の絵（のれんのロゴ入り）を 1/6 で描く（幅 256・高さ 213.3、下揃え）。
// 棚などの位置は、もとの 1536×1024 の絵（縦長の絵の y=256 から下）に合わせて論理座標で持っている
const BG_K = 1 / 6, BG_H = 1280, BG_Y = BH - BG_H * BG_K, CEIL = 40; // CEIL＝上に足りないときにくり返す天井の梁の高さ（元の絵の px。ランプの吊り具より上）
function drawBackground() {
  const im = IMG.workshop;
  ctx.setTransform(SC, 0, 0, SC, SC * ox, SC * oy);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  R(-ox, -oy, W, H, '#3a2210');
  if (!im.complete || !im.naturalWidth) return;
  // 縦長の画面では、上の余白に天井の梁をくり返す
  for (let y = BG_Y; y > -oy; y -= CEIL * BG_K) ctx.drawImage(im, 0, 0, 1536, CEIL, 0, y - CEIL * BG_K, BW, CEIL * BG_K);
  ctx.drawImage(im, 0, 0, 1536, BG_H, 0, BG_Y, BW, BG_H * BG_K);
  // 横長の画面では、左右の端を引きのばす
  if (ox > 0) {
    ctx.drawImage(im, 0, 0, 6, BG_H, -ox, BG_Y, ox, BG_H * BG_K);
    ctx.drawImage(im, 1530, 0, 6, BG_H, BW, BG_Y, W - BW - ox, BG_H * BG_K);
  }
}
// 背景の一部を前に描き直す（職人を作業台の後ろに隠す）
function redrawBg(sx, sy, sw, sh) {
  const im = IMG.workshop;
  if (im.complete && im.naturalWidth) ctx.drawImage(im, sx, sy, sw, sh, sx * BG_K, BG_Y + sy * BG_K, sw * BG_K, sh * BG_K);
}
// 札（濃紺のふち・生成りの地）
function plate(x, y, w, txt, c = INK, bg = '#fff8e8') { R(x, y, w, 9, INK); R(x + 0.5, y + 0.5, w - 1, 8, bg); T(txt, x + w / 2, y + 4.75, 7, c); }
// 左の木の棚＝乾燥棚。だるま3段×5体
const RACK_X0 = 16.7, RACK_X1 = 80, RACK_ROWS = [55, 71.7, 86.7];
function drawRack(fr) {
  const x0 = RACK_X0, x1 = RACK_X1, step = (x1 - x0) / 5;
  const spots = RACK_ROWS.length * 5;
  const used = rackUsed(S), per = Math.max(DRAW_UNIT, Math.ceil(rackCap(S) / spots));
  const shown = Math.min(spots, Math.ceil(used / per));
  // i 体目には「i*per 個目」が入っている束を描く
  const batchAt = u => { let acc = 0; for (const b of S.rack) { acc += b.n; if (u < acc) return b; } return null; };
  for (let i = 0; i < shown; i++) {
    const it = batchAt(i * per);
    if (!it) continue;
    const cx = x0 + step * (i % 5 + 0.5), by = RACK_ROWS[Math.floor(i / 5)];
    drawPart(ctx, 'daruma', it.c, cx, by, 12);
    if (it.ready > S.t) { if ((i + fr) % 4 === 0) { R(cx + 2, by - 14 - (fr % 2), 1, 1.5, '#ffffff'); R(cx + 3, by - 16 - (fr % 2), 1, 1, '#ffffff'); } } // 乾かし中の湯気
  }
  if (S.mat < 1) plate(22, 93, 36, '素材切れ', '#fff6e6', '#d8382a');
  plate(18, 112, 60, `乾燥 ${cnt(used)}個`);
}
// 右の飾り棚「だるま堂」＝完成品の在庫。4段×4体
const SHELF_X0 = 177.5, SHELF_X1 = 221.7, SHELF_ROWS = [71, 85, 99, 112.6];
function drawShelf() {
  const x0 = SHELF_X0, x1 = SHELF_X1, cx = (x0 + x1) / 2, step = (x1 - x0) / 4;
  T('だるま堂', cx, 55.3, 8, INK);
  // 1体＝DRAW_UNIT 個。16体まで並べ、あふれたら色の割合で並べる
  const spots = SHELF_ROWS.length * 4, list = [];
  for (const k of CK) for (let i = 0; i < Math.ceil(S.fin[k] / DRAW_UNIT) && list.length <= spots; i++) list.push(k);
  if (list.length > spots) { // 多いときは色の割合どおりに並べる
    const tot = finN(S); list.length = 0; let acc = 0;
    for (const k of CK) { acc += S.fin[k]; while (list.length < Math.round(acc / tot * spots)) list.push(k); }
  }
  list.slice(0, spots).forEach((k, i) => drawPart(ctx, 'daruma', k, x0 + step * (i % 4 + 0.5), SHELF_ROWS[Math.floor(i / 4)], 10.5));
  plate(x0, 113.5, x1 - x0, `在庫 ${cnt(finN(S))}個`);
}
// 右上の木箱の上の青いテレビ。画面にはバズ（テレビ特集・SNS）の対象色や自分の店のCMを映す
const TV_CX = 238, TV_BY = 44, TV_H = 22;
function drawTV(fr) {
  const d = Math.min(S.day, TOTAL - 1);
  const w = drawPart(ctx, 'icons', 'tv', TV_CX, TV_BY, TV_H);
  if (!w) return;
  const act = S.events.find(e => EVENT_TYPES[e.type].buzz && phase(e, d) === 'act');
  const ann = S.events.find(e => EVENT_TYPES[e.type].buzz && phase(e, d) === 'ann');
  // 画面の位置（アイコンの絵の中の割合）
  const sx = TV_CX - w / 2 + w * 0.1, sy = TV_BY - TV_H + TV_H * 0.33, sw = w * 0.62, sh = TV_H * 0.46;
  let k = null;
  if (act) { R(sx, sy, sw, sh, fr % 2 ? COLORS[act.color].h : '#fff6e6'); k = act.color; }
  else if (activeAd(S, 'tvcm')) { R(sx, sy, sw, sh, fr % 2 ? '#f7b7cf' : '#fbe38a'); k = 'red'; T('CM', sx + 3, sy + 2.5, 4, '#d8382a'); } // 自分の店のCM
  else if (ann) { R(sx, sy, sw, sh, '#fbe38a'); T('予告', sx + sw / 2, sy + sh / 2, 5, INK); }
  if (k) drawPart(ctx, 'daruma', k, sx + sw / 2 + (activeAd(S, 'tvcm') && !act ? 1.5 : 0), sy + sh - 0.5, sh - 1);
}
// 職人。作業台の後ろに立ち、色を選んでいれば筆で白だるまをその色に塗る（4コマ）。
// 絵は13人分（0＝自分、1〜12＝雇った職人。名簿の番号で決める）
const ART_K = 44 / 224, ART_FEET = 103.5, PAINT_MS = [180, 150, 180, 150];
function paintFrame(t) { let m = t % 660; for (let i = 0; i < 4; i++) { if (m < PAINT_MS[i]) return i; m -= PAINT_MS[i]; } return 0; }
function drawWorkers(t, working) {
  const team = [0, ...S.staff.map(c => 1 + (c.id % 12))];
  const n = team.length, x0 = 88, x1 = 164;
  const col = S.color === 'stop' ? null : S.color;
  team.forEach((a, i) => {
    const cx = n <= 3 ? 122 + (i - (n - 1) / 2) * 26 : x0 + i * (x1 - x0) / (n - 1);
    const flip = i % 2 === 1;
    if (!col || !working) { drawFig(ctx, 'artisans', `a${a}-idle`, cx, ART_FEET, ART_K, flip); return; }
    const id = `a${a}-p${paintFrame(t + i * 230)}`;
    drawFig(ctx, 'artisans', id, cx, ART_FEET, ART_K, flip);
    drawTinted(ctx, id, COLORS[col].b, cx, ART_FEET, ART_K, flip);
  });
  // 作業台を前に描き直して職人の下半身を隠し、台の上の絵の具・筆立て（切り抜き）を重ねる
  redrawBg(455, 818, 622, 190);
  const [fx, fy, fx1, fy1] = RECTS.bench, fg = IMG.bench;
  if (fg.complete && fg.naturalWidth) ctx.drawImage(fg, fx * BG_K, BG_Y + fy * BG_K, (fx1 - fx) * BG_K, (fy1 - fy) * BG_K);
}
// 床の左の段ボール＝素材の在庫
function drawMaterials() {
  const boxes = Math.min(4, Math.ceil(S.mat / (8 * DRAW_UNIT)));
  const pos = [[14, 175], [40, 175], [66, 175], [27, 158]];
  for (let i = 0; i < boxes; i++) drawPart(ctx, 'icons', 'sack', pos[i][0], pos[i][1], 20);
}
// 結果の吹き出しは国籍ごとの言葉で
const WORDS = {
  jp: { ok: '買った！', none: '売り切れ…', dear: '高い…' },
  cn: { ok: '買到了！', none: '賣完了…', dear: '太貴了…' },
  west: { ok: 'Nice!', none: 'Sold out…', dear: 'Too pricey…' },
};
function bubbleText(v) {
  const w = WORDS[v.origin] ?? WORDS.jp;
  if (v.refused) return [w.dear, '#d8382a'];
  if (v.sold === 0) return [w.none, '#d8382a'];
  if (v.sold < v.want) return [`${v.sold}個だけ…`, '#d8382a'];
  if (v.want === 1) return [w.ok, INK];
  return [v.type === 'trader' ? `${v.sold}個 仕入れ！` : `${v.sold}個！`, INK];
}
const CUST_K = 34 / 205, WALK_MS = 150; // 客の大きさ（論理 px / 絵の px）、歩く1コマの時間
function drawVisitors(t, fr) {
  const list = visitors.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  for (const v of list) {
    const cx = Math.round(v.x) + 10, walk = v.st !== 'wait', feet = VY + 34 + v.y;
    const anim = !!RECTS.people[v.look + '-w0'];
    // 歩く人は4コマ、立ち止まると足をそろえたコマ。1枚絵の人は歩くときに少し上下にゆれる
    const id = anim ? `${v.look}-w${walk ? (Math.floor(t / WALK_MS) + v.ph) % 4 : 1}` : v.look;
    drawFig(ctx, 'people', id, cx, feet + (walk && !anim ? ((fr + v.ph) % 2) * 0.5 : 0), CUST_K, v.flip);
    // 小売店は買った荷物を担いで帰る（業者は台車に積んでいる）
    if (v.st === 'out' && v.sold >= 5 && v.type !== 'trader') drawPart(ctx, 'icons', 'box', cx + 9, VY + v.y + 20, 9);
  }
  // 黒い支柱と紅白のロープ
  for (const px of [92, W - ox - 4]) { R(px, 150, 3, 26, '#202024'); R(px - 1, 148, 5, 3, '#3a3a40'); R(px + 0.5, 150, 1, 26, '#3a3a44'); }
  for (let x = 95; x < W - ox - 4; x += 4) { R(x, 156, 4, 2, ((x - 95) / 4) % 2 ? '#fff6e6' : '#d8382a'); }
  R(95, 158, W - ox - 99, 0.5, 'rgba(0,0,0,.25)');
  drawBubbles(list);
}
// 吹き出し。店先の客は結果（買った！／売り切れ…）、向かってくる客は「欲しい色のだるま×個数」。
// 2段（y=130・118）に重ならないよう置き、置けない分は省く。客ごとに前回の段を優先してちらつきを防ぐ
const BUBBLE_ROWS = [119, 105], MAX_BUBBLES = 8, VY = 136; // VY＝客の頭の高さ
function drawBubbles(list) {
  const rank = v => v.type === 'trader' ? 0 : v.sold < v.want ? 1 : v.type === 'shop' ? 2 : 3;
  // 結果の吹き出しは4つまでにして、残りを向かってくる客の「欲しいもの」に回す
  const waiting = list.filter(v => v.st === 'wait').sort((a, b) => rank(a) - rank(b) || a.wait - b.wait).slice(0, 4);
  const coming = list.filter(v => v.st === 'in').sort((a, b) => a.x - b.x);
  const placed = BUBBLE_ROWS.map(() => []); // 段ごとの使用中の横範囲
  ctx.font = '7px "DotGothic16",sans-serif';
  let count = 0;
  for (const v of [...waiting, ...coming]) {
    if (count >= MAX_BUBBLES) break;
    const want = v.st === 'in';
    const [txt, col] = want ? [`×${v.want}`, INK] : bubbleText(v);
    const tw = Math.ceil(ctx.measureText(txt).width), w = want ? tw + 17 : tw + 6;
    const x = Math.round(v.x) + 10, bx = Math.max(4, Math.min(W - ox * 2 - w - 2, x - w / 2));
    const order = v.row === 1 ? [1, 0] : [0, 1];
    const row = order.find(r => !placed[r].some(([l, rr]) => bx < rr + 2 && bx + w > l - 2));
    if (row === undefined) continue;
    v.row = row; placed[row].push([bx, bx + w]); count++;
    const by = BUBBLE_ROWS[row], head = VY + v.y;
    R(bx, by, w, 13, INK); R(bx + 1, by + 1, w - 2, 11, '#fff8ea');
    R(x - 1, by + 13, 2, Math.max(1, head - by - 13), INK); // しっぽ
    if (want) { dar(v.k, bx + 1.5, by + 0.5); T(txt, bx + 14 + tw / 2, by + 6.5, 7, col); }
    else T(txt, bx + w / 2, by + 6.5, 7, col);
  }
}
// 季節の旗飾り（横にくり返す帯）
const BANNER_H = 16;
function drawBunting(id) {
  const im = IMG.banners, r = RECTS.banners[id];
  if (!r || !im.complete || !im.naturalWidth) return;
  const w = BANNER_H * r[2] / r[3];
  for (let x = -ox - (ox % w); x < W - ox; x += w) ctx.drawImage(im, ...r, x, 2, w, BANNER_H);
}

// 描画順：背景 → 乾燥棚 → テレビ → 飾り棚 → 職人と作業台 → 素材 → 客とロープ → 旗飾り
export function drawScene(t, state, speed) {
  S = state;
  if (!S || !cv || !cv.width) return;
  const fr = Math.floor(t / 300), d = Math.min(S.day, TOTAL - 1);
  drawBackground();
  drawRack(fr); drawTV(fr); drawShelf();
  const working = speed > 0 && !prodReason(S);
  drawWorkers(t, working); drawMaterials(); drawVisitors(t, fr);
  // 旗飾り：季節イベント（桜・春節）、なければ年末商戦
  const banner = activeEvents(S, d).map(e => EVENT_TYPES[e.type].banner).find(Boolean);
  if (banner) drawBunting(banner);
  else if (inRush(d)) drawBunting('yearend');
}
