// タイトル画面の看板ロゴ「開運！だるま屋伝説 〜夢のユニコーン企業編〜」をドット絵で描く（200×120 の canvas）
import { BIG, spr, darPal } from './sprites.js';

const INK = '#2a1a10', CREAM = '#fff3d6', WOOD = '#9a5a2b', WOOD2 = '#7a4420', WOOD3 = '#b8743a';
const FONT = '"DotGothic16","Hiragino Kaku Gothic ProN",sans-serif';

function R(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
// ふち取りの文字（8方向にずらして影を描いてから本体）
function outlined(g, text, x, y, size, fill, line = INK, w = 2) {
  g.font = `${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = line;
  for (let dx = -w; dx <= w; dx++) for (let dy = -w; dy <= w; dy++) if (dx || dy) g.fillText(text, x + dx, y + dy);
  g.fillStyle = fill; g.fillText(text, x, y);
}
// ドット絵の雲
function cloud(g, x, y, s = 1) {
  const rows = ['...wwww.....', '..wwwwww.ww.', '.wwwwwwwwwww', 'wwwwwwwwwwww', 'bbwwwwwwwwbb', '.bbbbbbbbbb.'];
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') R(g, x + i * s, y + j * s, s, s, ch === 'w' ? '#ffffff' : '#c9daf7'); }));
}
// 木の板（ふち・木目つき）
function board(g, x, y, w, h) {
  R(g, x, y, w, h, INK); R(g, x + 2, y + 2, w - 4, h - 4, WOOD);
  for (let yy = y + 6; yy < y + h - 3; yy += 7) R(g, x + 3, yy, w - 6, 1, WOOD2);
  R(g, x + 2, y + 2, w - 4, 2, WOOD3);
  for (const [px, py] of [[x + 4, y + 4], [x + w - 6, y + 4], [x + 4, y + h - 6], [x + w - 6, y + h - 6]]) R(g, px, py, 2, 2, INK); // くぎ
}

export function drawTitleLogo(cv) {
  const g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  // 雲
  cloud(g, 2, 66, 2); cloud(g, 166, 40, 2); cloud(g, 66, 38, 1); cloud(g, 176, 74, 1);
  // 「開運！」の立て看板
  R(g, 46, 40, 4, 22, INK); R(g, 47, 40, 2, 22, WOOD2);
  R(g, 22, 12, 56, 30, INK); R(g, 24, 14, 52, 26, CREAM); R(g, 24, 14, 52, 2, '#ffffff');
  for (const [px, py] of [[26, 16], [72, 16], [26, 36], [72, 36]]) R(g, px, py, 2, 2, INK);
  g.font = `16px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#d8382a'; g.fillText('開運！', 50, 28);
  // 驚いた顔のピンクのだるまと集中線
  spr(BIG, darPal('pink'), 96, 6, 3, g);
  for (const [x, y, w, h] of [[84, 8, 3, 7], [88, 18, 4, 3], [140, 6, 3, 7], [144, 16, 4, 3], [146, 26, 4, 3], [82, 26, 4, 3]]) { R(g, x - 1, y - 1, w + 2, h + 2, INK); R(g, x, y, w, h, '#f5c742'); }
  // 大看板「だるま屋伝説」
  board(g, 10, 52, 180, 38);
  outlined(g, 'だるま屋', 82, 71, 23, CREAM);
  outlined(g, '伝説', 155, 71, 23, '#f5c742');
  // リボン「〜夢のユニコーン企業編〜」
  R(g, 20, 96, 12, 16, '#a82418'); R(g, 168, 96, 12, 16, '#a82418'); R(g, 20, 104, 4, 8, '#1f52c4'); R(g, 176, 104, 4, 8, '#1f52c4');
  R(g, 28, 92, 144, 18, INK); R(g, 30, 94, 140, 14, CREAM);
  R(g, 30, 94, 3, 14, '#d8382a'); R(g, 167, 94, 3, 14, '#d8382a');
  g.font = `10px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#1d2147';
  g.fillText('〜夢のユニコーン企業編〜', 100, 101.5);
  crisp(g, cv.width, cv.height);
}

// 文字のなめらか処理で出た半透明のふちをなくして、くっきりしたドットにする
function crisp(g, w, h) {
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 110 ? 255 : 0;
  g.putImageData(img, 0, 0);
}
