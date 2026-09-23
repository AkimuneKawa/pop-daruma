// 工房シーンの canvas 描画（基準 256x176 の論理座標、下揃え）
import { INK, COLORS, CK, TOTAL, DRAW_UNIT } from './constants.js';
import { BIG, MINI, PERSON, BACK, spr, darPal } from './sprites.js';
import { rint, cnt } from './util.js';
import { rackCap, rackUsed, finN, phase, prodReason } from './sim.js';

// 絵のだるま1体＝DRAW_UNIT 個として描く（乾燥棚だけは容量に合わせて1体あたりを増やす）

const BW = 256, BH = 176, FLOOR = 130;
const CUST = [['#2f3f8a','#2f63d6','#fff6e6'],['#5a3a22','#f5c742','#d8382a'],['#3a2a20','#3aae78','#fff6e6'],['#9a9a9a','#8a5a2b','#fff6e6'],['#2a1a14','#f7b7cf','#fff6e6']];
const SHOP = [['#2a1a14','#d8382a','#fff6e6'],['#5a3a22','#2f63d6','#fff6e6']]; // 小売店：はっぴ
const TRADER = [['#2a1a14','#3a3a4a','#2a2a3a'],['#6b6358','#3a3a4a','#2a2a3a']]; // 業者：背広
const MAX_VISITORS = 24, WALK = 110, WAIT = 0.6; // 画面に出す客の上限、歩く速さ(px/秒)、店先で止まる秒数
const RACK_SPOTS = 72; // 乾燥棚に並べられる小さいだるまの数（6段×奥と手前6体ずつ）
const QC = ['#f4a6a0','#f5c742','#8fd6b4','#9cc7ef','#f0782a','#fbe38a','#5cc4d8','#f7b7cf','#d8382a','#3aae78'];

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
  SC = Math.max(2, Math.min(5, Math.round(r.width * dpr / W)));
  cv.width = W * SC; cv.height = H * SC;
}

/* ---------- 客 ---------- */
// 客1人。type＝person/shop/trader、want＝欲しい個数、sold＝買えた個数
export function addVisitor(k, type, want, sold) {
  if (visitors.length >= MAX_VISITORS) return;
  const pals = type === 'trader' ? TRADER : type === 'shop' ? SHOP : CUST;
  visitors.push({ x: W - ox + 2 + rint(0, 20), y: rint(0, 4), tx: rint(124, 218), k, type, want, sold, st: 'in', wait: 0, pal: pals[rint(0, pals.length - 1)] });
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
function R(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
function circ(cx, cy, r, c) { ctx.fillStyle = c; for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy)); ctx.fillRect(cx - w, cy + dy, w * 2 + 1, 1); } }
function ell(cx, cy, rx, ry, c, top) { ctx.fillStyle = c; for (let dy = -ry; dy <= (top ? 0 : ry); dy++) { const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry)))); ctx.fillRect(cx - w, cy + dy, w * 2 + 1, 1); } }
function T(s, x, y, size, c, align) { ctx.font = `${size}px "DotGothic16",sans-serif`; ctx.fillStyle = c; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); }
const sp = (map, pal, x, y, s = 1) => spr(map, pal, x, y, s, ctx);

/* ---------- 各パーツ ---------- */
function drawBackground() {
  // canvas 全体（平行移動前の座標）
  ctx.setTransform(SC, 0, 0, SC, 0, 0);
  R(0, 0, W, H, '#f3e2bf');
  for (let x = 2; x < W; x += 7) R(x, 0, 1, oy + FLOOR, '#ead5a8');
  R(0, 0, W, 5, '#6b4424'); R(0, 5, W, 1, INK);
  if (oy > 12) { for (let x = ox + 20; x < ox + BW; x += 54) { R(x, 6, 3, oy - 4, '#8a5a2b'); } R(0, oy, W, 3, '#8a5a2b'); R(0, oy + 3, W, 1, '#6b4424'); }
  // 腰板
  R(0, oy + 118, W, 12, '#c99558'); R(0, oy + 118, W, 1, INK);
  for (let x = 4; x < W; x += 12) R(x, oy + 119, 1, 11, '#a8743e');
  // 床
  R(0, oy + FLOOR - 1, W, 1, INK);
  for (let y = oy + FLOOR; y < H; y += 8) for (let x = 0; x < W; x += 8) R(x, y, 8, 8, (((x + y - oy) >> 3) & 1) ? '#5fc4a0' : '#8fd6b4');
  // 柱
  R(ox - 4, oy, 4, FLOOR - 1, '#8a5a2b'); R(ox + BW, oy, 4, FLOOR - 1, '#8a5a2b');
}
function drawNoren() {
  R(3, 6, 128, 2, '#6b4424'); R(3, 6, 2, 4, INK); R(129, 6, 2, 4, INK);
  R(6, 8, 122, 16, '#d8382a'); R(6, 8, 122, 1, '#a82418');
  for (let x = 26; x < 128; x += 20) R(x, 17, 1, 7, '#f3e2bf');
  R(6, 24, 122, 1, '#a82418');
  T('だるまは、しあわせをつくる', 66, 14, 8, '#fff6e6');
}
function drawLamps() {
  for (const x of [150, 176, 202]) {
    R(x, -oy, 1, 9 + oy, INK);
    for (let r = 0; r < 5; r++) R(x - 2 - r, 9 + r, 5 + r * 2, 1, r === 0 ? '#a82418' : '#d8382a');
    R(x - 7, 14, 15, 1, INK); R(x - 1, 15, 3, 2, '#fbe38a');
  }
}
function drawRack(fr) {
  const x0 = 3, y0 = 26;
  R(x0, y0 - 1, 54, 2, '#b7773a'); R(x0, y0 - 2, 54, 1, INK);
  R(x0, y0, 3, 92, '#7a4a22'); R(x0 + 51, y0, 3, 92, '#7a4a22');
  for (let r = 0; r < 6; r++) { const py = y0 + 14 + r * 15; R(x0, py, 54, 2, '#b7773a'); R(x0, py + 2, 54, 1, '#7a4a22'); }
  const used = rackUsed(S), per = Math.max(DRAW_UNIT, Math.ceil(rackCap(S) / RACK_SPOTS));
  const shown = Math.min(RACK_SPOTS, Math.ceil(used / per));
  // i 体目には「i*per 個目」が入っている束を描く
  const batchAt = u => { let acc = 0; for (const b of S.rack) { acc += b.n; if (u < acc) return b; } return null; };
  for (let r = 0; r < 6; r++) {
    const py = y0 + 14 + r * 15;
    for (const layer of [0, 1]) { // 0＝奥の列（少し上）、1＝手前の列
      for (let c = 0; c < 6; c++) {
        const i = r * 12 + layer * 6 + c;
        if (i >= shown) continue;
        const it = batchAt(i * per);
        if (!it) continue;
        const x = x0 + 3 + c * 8, y = py - (layer ? 8 : 12);
        sp(MINI, darPal(it.c), x, y);
        if (it.ready > S.t) { if ((i + fr) % 5 === 0) { R(x + 5, y - 2 - (fr % 2), 1, 2, '#ffffff'); R(x + 6, y - 4 - (fr % 2), 1, 1, '#ffffff'); } }
        else if ((fr + i) % 2 && i % 4 === 0) R(x + 3, y - 3, 2, 3, '#e2412f');
      }
    }
  }
  R(4, 119, 52, 10, INK); R(5, 120, 50, 8, '#fbf1dc');
  T(`乾燥 ${cnt(used)}個`, 30, 124.5, 7, INK);
}
function drawScroll() {
  R(62, 24, 20, 2, '#6b4424'); R(71, 20, 2, 4, INK);
  R(63, 26, 18, 56, '#2f63d6'); R(64, 27, 16, 54, '#fff6e6');
  ['七', '転', '八', '起'].forEach((c, i) => T(c, 72, 33 + i * 10, 9, INK));
  sp(MINI, darPal('red'), 68, 72);
  R(62, 82, 20, 2, '#6b4424');
}
function drawQuilt() {
  const x0 = 88, y0 = 28, n = 6, s = 7;
  R(x0 - 2, y0 - 3, n * s + 4, 2, '#6b4424');
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const c = QC[(i * 3 + j * 7 + i * j) % QC.length];
    R(x0 + i * s, y0 + j * s, s, s, c);
    if ((i + j) % 3 === 0) { R(x0 + i * s + 2, y0 + j * s + 3, 3, 1, '#fff6e6'); R(x0 + i * s + 3, y0 + j * s + 2, 1, 3, '#fff6e6'); }
  }
  R(x0, y0, n * s, 1, INK); R(x0, y0 + n * s, n * s + 1, 1, INK); R(x0, y0, 1, n * s, INK); R(x0 + n * s, y0, 1, n * s, INK);
}
function drawMirror() {
  const cx = 142, cy = 48;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) circ(Math.round(cx + Math.cos(a) * 7), Math.round(cy + Math.sin(a) * 19), 3, '#f0782a');
  ell(cx, cy, 7, 19, '#f0782a'); ell(cx, cy, 5, 16, '#9cc7ef');
  R(cx - 3, cy - 10, 1, 8, '#ffffff'); R(cx - 2, cy - 12, 1, 2, '#ffffff');
}
function drawTV(fr) {
  const d = Math.min(S.day, TOTAL - 1);
  R(160, 56, 52, 3, '#8a5a2b'); R(160, 59, 52, 1, INK); R(164, 60, 2, 5, '#6b4424'); R(206, 60, 2, 5, '#6b4424');
  R(172, 22, 1, 8, INK); R(171, 21, 1, 1, INK); R(192, 22, 1, 8, INK); R(193, 21, 1, 1, INK);
  R(168, 29, 30, 27, INK); R(169, 30, 28, 25, '#d8382a');
  R(171, 32, 19, 20, INK);
  const act = S.events.find(e => e.type === 'tv' && phase(e, d) === 'act');
  const ann = S.events.find(e => e.type === 'tv' && phase(e, d) === 'ann');
  if (act) { R(172, 33, 17, 18, fr % 2 ? COLORS[act.color].h : '#fff6e6'); sp(BIG, darPal(act.color), 174, 35); }
  else if (ann) { R(172, 33, 17, 18, '#fbe38a'); T('予告', 180.5, 42, 7, INK); }
  else { R(172, 33, 17, 18, '#8fb0c8'); sp(BIG, darPal('gray'), 174, 35); }
  R(192, 34, 3, 3, '#f5c742'); R(192, 40, 3, 3, '#f5c742'); R(192, 46, 3, 2, INK);
  // 吊り鉢植え
  R(206, 52, 6, 5, '#b7773a');
  for (let i = 0; i < 7; i++) { R(210 + (i % 2) * 2, 56 + i * 3, 3, 2, '#3aae78'); R(208 + ((i + 1) % 2) * 3, 57 + i * 3, 2, 2, '#2f8a58'); }
}
function drawSign() {
  R(238, 6, 15, 52, INK); R(239, 7, 13, 50, '#fbf1dc');
  ['笑', 'う', '門', 'に', '福'].forEach((c, i) => T(c, 245.5, 13 + i * 9.5, 8, i === 4 ? '#d8382a' : INK));
}
function drawShelf() {
  const cx = 226, x0 = 198, x1 = 254, top = 76;
  ell(cx, top, 28, 12, INK, true); ell(cx, top, 27, 11, '#fbf7ef', true);
  R(x0, top, x1 - x0, 54, INK); R(x0 + 1, top, x1 - x0 - 2, 53, '#fbf7ef');
  T('だるま堂', cx, top - 4, 8, INK);
  R(x0 + 3, top + 2, x1 - x0 - 6, 50, '#e8dcc6');
  // 1体＝DRAW_UNIT 個。3段×奥と手前6体ずつ＝36体まで並べ、あふれたら総数の札を出す
  const list = [];
  for (const k of CK) for (let i = 0; i < Math.ceil(S.fin[k] / DRAW_UNIT) && list.length < 37; i++) list.push(k);
  for (let r = 0; r < 3; r++) {
    const line = top + 17 + r * 16;
    R(x0 + 3, line, x1 - x0 - 6, 2, '#fbf7ef'); R(x0 + 3, line + 2, x1 - x0 - 6, 1, '#cdbfa5');
    for (const layer of [0, 1]) for (let c = 0; c < 6; c++) {
      const i = r * 12 + layer * 6 + c;
      if (i < Math.min(36, list.length)) sp(MINI, darPal(list[i]), x0 + 4 + c * 8, line - (layer ? 8 : 12));
    }
  }
  if (list.length > 36) { R(x1 - 25, top + 2, 22, 8, '#d8382a'); T(cnt(finN(S)), x1 - 14, top + 6, 6, '#fff6e6'); }
}
function drawWorkers(fr, working) {
  const P0 = { K: INK, H: '#2a1a14', R: '#fff6e6', S: '#f6c9a0', A: '#2f63d6', P: '#fff6e6' };
  const team = [{ x: 74, pal: P0 }];
  if (S.staff.includes('tatsu')) team.push({ x: 106, pal: { ...P0, H: '#8a8a8a', A: '#fff6e6', P: '#f0782a' } });
  if (S.staff.includes('hana')) team.push({ x: 138, pal: { ...P0, A: '#f0782a', P: '#fff6e6' } });
  team.forEach((m, i) => {
    const b = working ? ((fr + i) % 2) : 0;
    sp(PERSON, m.pal, m.x, 74 + b, 2);
    const col = S.color === 'stop' ? null : S.color;
    if (col) sp(BIG, darPal(col), m.x + 13, 90);
    if (working) { R(m.x + 4 + b * 2, 86 - b, 1, 7, '#8a5a2b'); R(m.x + 4 + b * 2, 85 - b, 1, 1, col ? COLORS[col].b : INK); }
  });
  // 作業台
  R(62, 102, 132, 6, '#c98a4a'); R(62, 102, 132, 1, INK); R(62, 108, 132, 1, INK);
  R(64, 109, 128, 9, '#a8703a'); R(64, 117, 128, 1, INK);
  for (let x = 70; x < 190; x += 24) R(x, 110, 1, 7, '#8a5a2b');
  // 台の上の絵の具壺
  [['#e2412f', 66], ['#3aae78', 104], ['#2f63d6', 170], ['#f5c742', 186]].forEach(([c, x]) => { R(x, 97, 6, 5, INK); R(x + 1, 98, 4, 4, c); });
  R(160, 92, 6, 10, INK); R(161, 93, 4, 9, '#6b4424'); R(161, 88, 1, 5, '#b7773a'); R(163, 87, 1, 6, '#b7773a'); R(162, 89, 1, 4, '#d8382a');
}
function drawMaterials() {
  const boxes = Math.min(4, Math.ceil(S.mat / (8 * DRAW_UNIT)));
  const pos = [[0, 152], [24, 152], [48, 152], [10, 136]];
  for (let i = 0; i < boxes; i++) { const [x, y] = pos[i]; R(x, y, 23, 17, INK); R(x + 1, y + 1, 21, 15, '#c99558'); R(x + 1, y + 6, 21, 1, '#a8743e'); R(x + 10, y + 1, 3, 5, '#a8743e'); T('だるま', x + 11.5, y + 11.5, 6, '#5a3a1e'); }
  const cans = Math.min(4, Math.ceil(S.mat / (4 * DRAW_UNIT)));
  const cc = ['#d8382a', '#3aae78', '#2f63d6', '#f5c742'];
  for (let i = 0; i < cans; i++) { const x = 76 + i * 13, y = 136; R(x, y, 11, 13, INK); R(x + 1, y + 1, 9, 11, cc[i]); R(x + 1, y + 1, 9, 2, '#fff6e6'); R(x + 1, y + 3, 9, 1, INK); }
  if (S.mat < 1) { R(80, 140, 38, 11, '#d8382a'); R(80, 140, 38, 1, INK); T('素材切れ', 99, 145.5, 7, '#fff6e6'); }
}
function bubbleText(v) {
  if (v.sold === 0) return ['売り切れ…', '#d8382a'];
  if (v.sold < v.want) return [`${v.sold}個だけ…`, '#d8382a'];
  if (v.want === 1) return ['買った！', INK];
  return [v.type === 'trader' ? `${v.sold}個 仕入れ！` : `${v.sold}個！`, INK];
}
function drawVisitors(fr) {
  const list = visitors.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  for (const v of list) {
    const x = Math.round(v.x), walk = v.st !== 'wait', y = 142 + v.y + (walk ? fr % 2 : 0);
    sp(BACK, { K: INK, H: v.pal[0], S: '#f6c9a0', A: v.pal[1], P: v.pal[2] }, x, y, 2);
    // 業者・小売店は買った荷物を担いで帰る
    if (v.st === 'out' && v.sold >= 5) { const w = v.type === 'trader' ? 12 : 8; R(x + 14, y + 2, w, 8, INK); R(x + 15, y + 3, w - 2, 6, '#c99558'); }
  }
  // ロープ
  R(116, 156, 4, 20, '#8a5a2b');
  for (let x = 120; x < W - ox; x += 6) R(x, 160, 6, 2, ((x / 6) | 0) % 2 ? '#fff6e6' : '#d8382a');
  drawBubbles(list);
}
// 吹き出し。店先の客は結果（買った！／売り切れ…）、向かってくる客は「欲しい色のだるま×個数」。
// 2段（y=130・118）に重ならないよう置き、置けない分は省く。客ごとに前回の段を優先してちらつきを防ぐ
const BUBBLE_ROWS = [130, 118], MAX_BUBBLES = 8;
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
    const tw = Math.ceil(ctx.measureText(txt).width), w = want ? tw + 15 : tw + 6;
    const x = Math.round(v.x) + 10, bx = Math.max(4, Math.min(W - ox * 2 - w - 2, x - w / 2));
    const order = v.row === 1 ? [1, 0] : [0, 1];
    const row = order.find(r => !placed[r].some(([l, rr]) => bx < rr + 2 && bx + w > l - 2));
    if (row === undefined) continue;
    v.row = row; placed[row].push([bx, bx + w]); count++;
    const by = BUBBLE_ROWS[row], head = 142 + v.y;
    R(bx, by, w, 11, INK); R(bx + 1, by + 1, w - 2, 9, '#fff6e6');
    R(x - 1, by + 11, 3, Math.max(1, head - by - 11), INK); // しっぽ
    if (want) { sp(MINI, darPal(v.k), bx + 2, by + 1); T(txt, bx + 12 + tw / 2, by + 5.5, 7, col); }
    else T(txt, bx + w / 2, by + 5.5, 7, col);
  }
}
function drawBunting(cols) {
  for (let i = -2; i < W / 10; i++) {
    const x = i * 10 + 2 - ox, c = cols[(i + 20) % cols.length];
    for (let r = 0; r < 4; r++) R(x + r, 6 + r, 7 - 2 * r, 1, c);
  }
}

// 描画順は HANDOFF.md 第5章のとおり
export function drawScene(t, state, speed) {
  S = state;
  if (!S || !cv || !cv.width) return;
  const fr = Math.floor(t / 300), d = Math.min(S.day, TOTAL - 1);
  drawBackground();
  ctx.setTransform(SC, 0, 0, SC, SC * ox, SC * oy);
  drawNoren(); drawLamps(); drawRack(fr); drawScroll(); drawQuilt(); drawMirror(); drawTV(fr); drawSign(); drawShelf();
  const working = speed > 0 && !prodReason(S);
  drawWorkers(fr, working); drawMaterials(); drawVisitors(fr);
  if (d >= 80 && d < 100) drawBunting(['#d8382a', '#fff6e6']);
  else if (S.events.some(e => e.type === 'inbound' && phase(e, d) === 'act')) drawBunting(['#d8382a', '#f5c742', '#5fc4a0', '#2f63d6', '#f0782a']);
}
